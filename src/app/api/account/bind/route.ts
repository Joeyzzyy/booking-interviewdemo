import {
  bindChannel,
  getSessionCustomer,
  isChannel,
  normalizeIdentifier,
  verifyOtpCode,
} from "@/lib/booking/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/account/bind（需登入）
 * body: { channel, identifier, code } — 校驗驗證碼後把聯絡方式綁定到當前賬戶。
 */
export async function POST(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }

  let body: { channel?: string; identifier?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const channel = body.channel;
  if (!isChannel(channel)) {
    return Response.json({ error: "不支持的方式" }, { status: 400 });
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

  const { customer: updated, error } = await bindChannel(customer.id, channel, identifier);
  if (error || !updated) {
    return Response.json({ error: error || "綁定失敗" }, { status: 400 });
  }
  return Response.json({
    ok: true,
    customer: { id: updated.id, email: updated.email, phone: updated.phone },
  });
}
