import { createEmailCode, isValidEmail, normalizeEmail } from "@/lib/booking/auth";
import { sendVerificationCodeEmail } from "@/lib/booking/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/send-code
 * body: { email } — 發送 6 位登入驗證碼。
 * 未配置 RESEND_API_KEY 時：生產環境返回 503；開發環境返回 devCode 方便測試。
 */
export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  const email = normalizeEmail(body.email || "");
  if (!isValidEmail(email)) {
    return Response.json({ error: "請填寫有效電郵地址" }, { status: 400 });
  }

  const { code, error } = await createEmailCode(email);
  if (error === "服務暫時不可用") {
    return Response.json({ error }, { status: 503 });
  }
  if (error) {
    return Response.json({ error }, { status: 429 });
  }

  const sent = await sendVerificationCodeEmail(email, code!);
  if (!sent) {
    if (process.env.NODE_ENV === "production") {
      return Response.json({ error: "驗證碼發送失敗，請稍後再試" }, { status: 503 });
    }
    console.log(`[auth] 開發模式驗證碼 ${email}: ${code}`);
    return Response.json({ ok: true, devCode: code });
  }
  return Response.json({ ok: true });
}
