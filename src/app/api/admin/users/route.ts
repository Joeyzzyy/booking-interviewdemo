import { getSupabase } from "@/lib/booking/db";
import { adminUnauthorized, isAdminRequest } from "@/lib/booking/admin-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users — 全部客戶列表（用戶管理，最多 300 條，新到舊）
 */
export async function GET(request: Request) {
  if (!isAdminRequest(request)) return adminUnauthorized();
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "數據庫未配置" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id, email, phone, applicant_name, company_name, profile_status, is_admin, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) {
    console.error("[admin] 讀取用戶列表失敗:", error);
    return Response.json({ error: "讀取失敗" }, { status: 500 });
  }
  return Response.json({ users: data || [] });
}

/**
 * POST /api/admin/users
 * body: { customerId, isAdmin: boolean } — 設置 / 取消用戶管理員權限
 */
export async function POST(request: Request) {
  if (!isAdminRequest(request)) return adminUnauthorized();
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "數據庫未配置" }, { status: 503 });
  }

  let body: { customerId?: string; isAdmin?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  const { customerId, isAdmin } = body;
  if (!customerId || typeof isAdmin !== "boolean") {
    return Response.json({ error: "參數錯誤" }, { status: 400 });
  }

  const { error } = await supabase
    .from("customers")
    .update({ is_admin: isAdmin })
    .eq("id", customerId);
  if (error) {
    console.error("[admin] 更新管理員權限失敗:", error);
    return Response.json({ error: "操作失敗，請稍後再試" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
