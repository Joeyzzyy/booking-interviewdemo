import { createOtpCode, isChannel, normalizeIdentifier } from "@/lib/booking/auth";
import { sendVerificationCodeEmail } from "@/lib/booking/email";
import { sendVerificationCodeSms, smsConfigured } from "@/lib/booking/sms";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/send-code
 * body: { channel: "email" | "phone", identifier }
 * 發送 6 位登入驗證碼。
 * 未配置對應通道服務時：生產環境返回 503；開發環境返回 devCode 方便測試。
 */
export async function POST(request: Request) {
  let body: { channel?: string; identifier?: string };
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
  if (!identifier) {
    return Response.json(
      { error: channel === "email" ? "請填寫有效電郵地址" : "請填寫有效手機號碼" },
      { status: 400 }
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
      ? await sendVerificationCodeEmail(identifier, code!)
      : await sendVerificationCodeSms(identifier, code!);

  if (!sent) {
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        { error: channel === "email" ? "驗證碼發送失敗，請稍後再試" : "短訊服務暫不可用，請改用電郵登入" },
        { status: 503 }
      );
    }
    console.log(`[auth] 開發模式驗證碼 ${channel} ${identifier}: ${code}`);
    return Response.json({ ok: true, devCode: code, channel });
  }
  return Response.json({ ok: true, channel });
}
