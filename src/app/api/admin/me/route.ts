import { isAdminRequest } from "@/lib/booking/admin-auth";

export const dynamic = "force-dynamic";

/** GET /api/admin/me — 管理後台門禁狀態（前端進入 /admin 時檢查） */
export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "未授權" }, { status: 401 });
  }
  return Response.json({ ok: true });
}
