import { adminCookieHeader, createAdminToken, verifyAdminPassword } from "@/lib/booking/admin-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/login
 * body: { password } — 校驗管理後台密碼，通過後簽發 httpOnly 門禁 cookie（12 小時）。
 */
export async function POST(request: Request) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  const password = (body.password || "").trim();
  if (!password) {
    return Response.json({ error: "請填寫密碼" }, { status: 400 });
  }
  if (!verifyAdminPassword(password)) {
    return Response.json({ error: "密碼錯誤" }, { status: 401 });
  }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": adminCookieHeader(createAdminToken()) } });
}
