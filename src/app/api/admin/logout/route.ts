import { clearAdminCookieHeader } from "@/lib/booking/admin-auth";

export const dynamic = "force-dynamic";

/** POST /api/admin/logout — 註銷管理後台門禁會話 */
export async function POST() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearAdminCookieHeader() } });
}
