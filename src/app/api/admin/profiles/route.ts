import { getSupabase, STORAGE_BUCKET } from "@/lib/booking/db";
import { adminUnauthorized, isAdminRequest } from "@/lib/booking/admin-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/profiles?status=pending|approved|rejected|all
 * 已提交註冊資料的用戶列表（審核區）。名片附 1 小時 signed URL。
 */
export async function GET(request: Request) {
  if (!isAdminRequest(request)) return adminUnauthorized();
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "數據庫未配置" }, { status: 503 });
  }

  const status = new URL(request.url).searchParams.get("status");
  // 只列出已提交資料的用戶（未填完的不進審核區）
  let query = supabase
    .from("customers")
    .select(
      "id, email, phone, created_at, applicant_name, company_name, labour_reg_no, id_card_path, profile_status, profile_reject_reason, profile_submitted_at"
    )
    .not("applicant_name", "is", null)
    .order("profile_submitted_at", { ascending: false })
    .limit(200);
  if (status && status !== "all") {
    query = query.eq("profile_status", status);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[admin] 讀取用戶資料失敗:", error);
    return Response.json({ error: "讀取失敗" }, { status: 500 });
  }
  const profiles = data || [];

  // 名片批量生成 signed URL（1 小時有效）
  const paths = profiles.map((p) => p.id_card_path).filter(Boolean) as string[];
  const urlMap = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(paths, 3600);
    for (const s of signed || []) {
      if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl);
    }
  }

  return Response.json({
    profiles: profiles.map((p) => ({
      ...p,
      id_card_url: p.id_card_path ? urlMap.get(p.id_card_path) || null : null,
    })),
  });
}

/**
 * POST /api/admin/profiles
 * body: { customerId, action: "approve" | "reject", reason?: string }
 * reject 必須填原因（用戶重填表單時會看到）。
 */
export async function POST(request: Request) {
  if (!isAdminRequest(request)) return adminUnauthorized();
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "數據庫未配置" }, { status: 503 });
  }

  let body: { customerId?: string; action?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  const { customerId, action } = body;
  const reason = (body.reason || "").trim();
  if (!customerId || (action !== "approve" && action !== "reject")) {
    return Response.json({ error: "參數錯誤" }, { status: 400 });
  }
  if (action === "reject" && !reason) {
    return Response.json({ error: "拒絕時必須填寫原因" }, { status: 400 });
  }

  const { error } = await supabase
    .from("customers")
    .update(
      action === "approve"
        ? { profile_status: "approved", profile_reject_reason: null }
        : { profile_status: "rejected", profile_reject_reason: reason }
    )
    .eq("id", customerId);
  if (error) {
    console.error("[admin] 審核更新失敗:", error);
    return Response.json({ error: "操作失敗，請稍後再試" }, { status: 500 });
  }

  // 審核結果郵件通知用戶（僅綁定電郵嘅賬戶；未配置郵件服務時靜默跳過）
  let emailSent = false;
  const { data: target } = await supabase
    .from("customers")
    .select("email, applicant_name")
    .eq("id", customerId)
    .maybeSingle();
  if (target?.email) {
    const { sendProfileReviewEmail } = await import("@/lib/booking/email");
    emailSent = await sendProfileReviewEmail(
      target.email,
      target.applicant_name || "客戶",
      action === "approve",
      reason
    ).catch((e) => {
      console.error("[admin] 審核通知郵件失敗:", e);
      return false;
    });
  }

  return Response.json({ ok: true, emailSent });
}
