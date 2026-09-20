import {
  createSession,
  isValidEmail,
  normalizeEmail,
  sessionCookieHeader,
  verifyEmailCode,
} from "@/lib/booking/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify
 * body: { email, code } — 校驗驗證碼，成功後建立會話（httpOnly cookie，30 天）。
 * 首次驗證即自動註冊。
 */
export async function POST(request: Request) {
  let body: { email?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  const email = normalizeEmail(body.email || "");
  const code = (body.code || "").trim();
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return Response.json({ error: "請填寫電郵及 6 位驗證碼" }, { status: 400 });
  }

  const { customer, error } = await verifyEmailCode(email, code);
  if (error || !customer) {
    return Response.json({ error: error || "驗證失敗" }, { status: 400 });
  }

  const session = await createSession(customer.id);
  if (!session) {
    return Response.json({ error: "登入失敗，請稍後再試" }, { status: 500 });
  }

  return Response.json(
    { ok: true, customer: { email: customer.email } },
    { headers: { "Set-Cookie": sessionCookieHeader(session.token, session.expires) } }
  );
}
