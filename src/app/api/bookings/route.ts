import { getSupabase, generateOrderNo, STORAGE_BUCKET, type Booking } from "@/lib/booking/db";
import { getService, UPLOAD_LIMITS } from "@/lib/booking/services";
import { sendNewOrderNotice } from "@/lib/booking/email";
import { getSessionCustomer } from "@/lib/booking/auth";
import { consumeCredit, refundCredit } from "@/lib/booking/passes";

export const dynamic = "force-dynamic";

/** 簡單字符清理：保留中英文、數字、常見符號 */
function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^\w一-龥.-]+/g, "_").slice(-80);
  return cleaned || "file";
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * POST /api/bookings
 * multipart/form-data：serviceKey + 通用欄位 + 服務專屬欄位 + files[]（可多個）
 */
export async function POST(request: Request) {
  // 必須登入：訂單綁定用戶賬號
  const customer = await getSessionCustomer(request);
  if (!customer) {
    return Response.json({ error: "請先登入後再預約" }, { status: 401 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "服務暫時不可用，請稍後再試" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v.trim() : "";
  };

  // 服務項校驗
  const service = getService(get("serviceKey"));
  if (!service) {
    return Response.json({ error: "請選擇服務項目" }, { status: 400 });
  }

  // 通用欄位校驗（賬戶有電郵則以賬戶為準；手機號註冊且未綁電郵時，接受表單聯絡電郵）
  const employerName = get("employerName");
  const phone = get("phone");
  const whatsapp = get("whatsapp");
  const workerName = get("workerName");
  const passport = get("passport");
  const email = customer.email || get("contactEmail");
  if (!employerName || !phone || !whatsapp || !workerName || !passport) {
    return Response.json(
      { error: "請填寫僱主姓名、聯絡電話、WhatsApp、工人姓名及護照號碼" },
      { status: 400 }
    );
  }
  if (!isValidEmail(email)) {
    return Response.json(
      { error: customer.email ? "請填寫有效電郵地址" : "請填寫有效的聯絡電郵（用於接收確認通知）" },
      { status: 400 }
    );
  }

  // 服務專屬欄位（required 校驗按配置）；護照號碼入 details
  const details: Record<string, string> = { "護照號碼": passport };
  for (const f of service.fields) {
    const v = get(`detail_${f.key}`);
    if (f.required && !v) {
      return Response.json({ error: `請填寫「${f.label}」` }, { status: 400 });
    }
    if (v) details[f.label] = v;
  }

  // 文件校驗（工人資料必傳）
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return Response.json({ error: "請上傳工人資料（簽證、護照或機票行程單）" }, { status: 400 });
  }
  if (files.length > UPLOAD_LIMITS.maxFiles) {
    return Response.json({ error: `最多上傳 ${UPLOAD_LIMITS.maxFiles} 個文件` }, { status: 400 });
  }
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > UPLOAD_LIMITS.maxTotalSize) {
    return Response.json({ error: "檔案合計不能超過 4MB" }, { status: 400 });
  }
  for (const f of files) {
    if (f.size > UPLOAD_LIMITS.maxFileSize) {
      return Response.json({ error: `文件「${f.name}」超過 4MB 上限` }, { status: 400 });
    }
    if (!(UPLOAD_LIMITS.acceptMime as readonly string[]).includes(f.type)) {
      return Response.json({ error: `文件「${f.name}」格式不支持（僅限 JPG/PNG/PDF）` }, { status: 400 });
    }
  }

  // 1) 先核銷套票（餘額不足則拒絕下單）
  const consumed = await consumeCredit(customer.id, service.key);
  if (!consumed) {
    return Response.json(
      { error: `你嘅「${service.label}」套票餘額不足，請先購買套票` },
      { status: 402 }
    );
  }

  // 2) 建訂單（套票預付，直接標記已付款）
  const { data: created, error: insertError } = await supabase
    .from("bookings")
    .insert({
      order_no: generateOrderNo(),
      service_key: service.key,
      service_label: service.label,
      price_hkd: service.priceSingle,
      employer_name: employerName,
      phone,
      whatsapp,
      email,
      worker_name: workerName,
      customer_id: customer.id,
      details,
      remark: get("remark") || null,
      files: [],
      payment_status: "paid",
    })
    .select()
    .single();

  if (insertError || !created) {
    console.error("[booking] 創建訂單失敗:", insertError);
    await refundCredit(customer.id, service.key); // 回滾核銷
    return Response.json({ error: "提交失敗，請稍後再試" }, { status: 500 });
  }
  const booking = created as Booking;

  // 3) 上傳文件到 Storage（失敗不阻塞訂單，記錄即可）
  const uploaded: Booking["files"] = [];
  for (const f of files) {
    const path = `${booking.id}/${Date.now()}-${sanitizeFilename(f.name)}`;
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type });
    if (upErr) {
      console.error(`[booking] 文件上傳失敗 ${f.name}:`, upErr);
      continue;
    }
    uploaded.push({ name: f.name, path, size: f.size });
  }
  if (uploaded.length > 0) {
    await supabase.from("bookings").update({ files: uploaded }).eq("id", booking.id);
    booking.files = uploaded;
  }

  // 3) 通知管理員（未配置郵件時自動跳過）
  await sendNewOrderNotice(booking).catch((e) => console.error("[booking] 管理員通知失敗:", e));

  return Response.json({ orderNo: booking.order_no, id: booking.id }, { status: 201 });
}
