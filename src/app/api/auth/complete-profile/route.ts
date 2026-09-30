import { getSessionCustomer } from "@/lib/booking/auth";
import { getSupabase, STORAGE_BUCKET } from "@/lib/booking/db";

export const dynamic = "force-dynamic";

const ACCEPT = ["image/jpeg", "image/png", "application/pdf"];

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^\w一-龥.-]+/g, "_").slice(-80);
  return cleaned || "file";
}

/**
 * POST /api/auth/complete-profile
 * multipart: applicantName + companyName + labourRegNo + idCard（圖片/PDF ≤4MB）
 * 註冊後進入功能前必須補全嘅資料；已補全亦可調用更新。
 */
export async function POST(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "服務暫時不可用" }, { status: 503 });
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
  const applicantName = get("applicantName");
  const companyName = get("companyName");
  const labourRegNo = get("labourRegNo");
  if (!applicantName || !companyName || !labourRegNo) {
    return Response.json(
      { error: "請填寫申請人姓名、公司名稱及勞工處登記編號" },
      { status: 400 }
    );
  }

  const idCard = form.get("idCard");
  if (!(idCard instanceof File) || idCard.size === 0) {
    return Response.json({ error: "請上傳公司名片照片" }, { status: 400 });
  }
  if (!ACCEPT.includes(idCard.type)) {
    return Response.json({ error: "名片格式不支持（僅限 JPG/PNG/PDF）" }, { status: 400 });
  }
  if (idCard.size > 4 * 1024 * 1024) {
    return Response.json({ error: "名片檔案超過 4MB 上限，請壓縮後再上傳" }, { status: 400 });
  }

  // 上傳名片到私有桶
  const path = `id-cards/${customer.id}/${Date.now()}-${sanitizeFilename(idCard.name)}`;
  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, Buffer.from(await idCard.arrayBuffer()), { contentType: idCard.type });
  if (upErr) {
    console.error("[complete-profile] 名片上傳失敗:", upErr);
    return Response.json({ error: "上傳失敗，請稍後再試" }, { status: 500 });
  }

  const { error: updErr } = await supabase
    .from("customers")
    .update({
      applicant_name: applicantName,
      company_name: companyName,
      labour_reg_no: labourRegNo,
      id_card_path: path,
      // 提交後重新進入待審核，清除上次拒絕原因
      profile_status: "pending",
      profile_reject_reason: null,
      profile_submitted_at: new Date().toISOString(),
    })
    .eq("id", customer.id);
  if (updErr) {
    console.error("[complete-profile] 更新失敗:", updErr);
    return Response.json({ error: "保存失敗，請稍後再試" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
