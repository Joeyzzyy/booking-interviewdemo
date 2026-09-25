import { brand } from "@/lib/brand";

/**
 * 短訊發送（僅服務端）。目前支持 Twilio（未配置時降級）。
 *
 * 環境變量：
 *   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER
 *
 * 未配置時 sendVerificationCodeSms 返回 false，由調用方在開發環境回退顯示 devCode，
 * 生產環境則提示「短訊服務未配置」。若要接其他供應商（如阿里雲 / Vonage），
 * 在 sendVerificationCodeSms 內按環境變量分流即可。
 */

function getTwilioConfig(): { sid: string; token: string; from: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return null;
  return { sid, token, from };
}

/** 發送登入 / 綁定驗證碼短訊；成功返回 true，未配置或失敗返回 false */
export async function sendVerificationCodeSms(to: string, code: string): Promise<boolean> {
  const cfg = getTwilioConfig();
  if (!cfg) {
    console.warn("[sms] Twilio 未配置，跳過發送短訊");
    return false;
  }

  const body = new URLSearchParams({
    To: to,
    From: cfg.from,
    Body: `【${brand.name}】你的驗證碼是 ${code}，10 分鐘內有效。請勿轉發他人。`,
  });

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }
    );
    if (!res.ok) {
      console.error("[sms] Twilio 發送失敗:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[sms] Twilio 請求異常:", e);
    return false;
  }
}

/** 是否已配置短訊服務（用於 API 判斷可否回退 devCode） */
export function smsConfigured(): boolean {
  return getTwilioConfig() !== null;
}
