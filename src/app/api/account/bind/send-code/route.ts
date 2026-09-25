import {
  createOtpCode,
  findCustomerBy,
  getSessionCustomer,
  isChannel,
  normalizeIdentifier,
} from "@/lib/booking/auth";
import { sendVerificationCodeEmail } from "@/lib/booking/email";
import { sendVerificationCodeSms } from "@/lib/booking/sms";

export const dynamic = "force-dynamic";

/**
 * POST /api/account/bind/send-code（需登入）
 * body: { channel, identifier } — 為「綁定新聯絡方式」發送驗證碼。
 * 該標識已被其他賬戶使用時拒絕。
 */
export async function POST(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }

  let body: { channel?: string; identifier?: string };
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
  if (!identifier) {
    return Response.json(
      { error: channel === "email" ? "請填寫有效電郵地址" : "請填寫有效手機號碼" },
      { status: 400 }
    );
  }

  if (customer[channel] === identifier) {
    return Response.json({ error: "該聯絡方式已在你的賬戶上" }, { status: 400 });
  }
  const owner = await findCustomerBy(channel, identifier);
  if (owner && owner.id !== customer.id) {
    return Response.json(
      { error: channel === "email" ? "該電郵已綁定其他賬戶" : "該手機號已綁定其他賬戶" },
      { status: 409 }
    );
  }

  const { code, error } = await createOtpCode(identifier, channel);
  if (error === "服務暫時不可用") {
    return Response.json({ error }, { status: 503 });
  }
  if (error) {
    return Response.json({ error }, { status: 429 });
  }

  const sent =
    channel === "email"
      ? await sendVerificationCodeEmail(identifier, code!, "bind")
      : await sendVerificationCodeSms(identifier, code!);

  if (!sent) {
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        { error: channel === "email" ? "驗證碼發送失敗，請稍後再試" : "短訊服務暫不可用" },
        { status: 503 }
      );
    }
    console.log(`[account] 開發模式綁定驗證碼 ${channel} ${identifier}: ${code}`);
    return Response.json({ ok: true, devCode: code });
  }
  return Response.json({ ok: true });
}
