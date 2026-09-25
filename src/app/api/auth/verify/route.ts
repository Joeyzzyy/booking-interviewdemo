import {
  createSession,
  findOrCreateCustomer,
  isChannel,
  normalizeIdentifier,
  sessionCookieHeader,
  verifyOtpCode,
} from "@/lib/booking/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify
 * body: { channel, identifier, code }
 * 校驗驗證碼，成功後查找或建立賬戶並建立會話（httpOnly cookie，30 天）。
 * 首次驗證即自動註冊。
 */
export async function POST(request: Request) {
  let body: { channel?: string; identifier?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const channel = body.channel;
  if (!isChannel(channel)) {
    return Response.json({ error: "不支持的登入方式" }, { status: 400 });
  }
  const identifier = normalizeIdentifier(channel, body.identifier || "");
  const code = (body.code || "").trim();
  if (!identifier || !/^\d{6}$/.test(code)) {
    return Response.json({ error: "請填寫標識及 6 位驗證碼" }, { status: 400 });
  }

  const verified = await verifyOtpCode(identifier, channel, code);
  if (!verified.ok) {
    return Response.json({ error: verified.error || "驗證失敗" }, { status: 400 });
  }

  const { customer, error } = await findOrCreateCustomer(channel, identifier);
  if (error || !customer) {
    return Response.json({ error: error || "登入失敗，請稍後再試" }, { status: 500 });
  }

  const session = await createSession(customer.id);
  if (!session) {
    return Response.json({ error: "登入失敗，請稍後再試" }, { status: 500 });
  }

  return Response.json(
    { ok: true, customer: { email: customer.email, phone: customer.phone } },
    { headers: { "Set-Cookie": sessionCookieHeader(session.token, session.expires) } }
  );
}
