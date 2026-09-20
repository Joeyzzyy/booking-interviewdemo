import { clearSessionCookieHeader, destroySession } from "@/lib/booking/auth";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — 註銷當前會話 */
export async function POST(request: Request) {
  await destroySession(request);
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearSessionCookieHeader() } }
  );
}
