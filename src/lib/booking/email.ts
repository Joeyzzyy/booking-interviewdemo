import { Resend } from "resend";
import type { Booking } from "./db";

/**
 * Resend 郵件發送（僅服務端）。
 * 未配置 RESEND_API_KEY 時靜默跳過並打印 warning，不阻斷訂單流程。
 */

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM = process.env.EMAIL_FROM || "Booking Demo <onboarding@resend.dev>";

const STATUS_TEXT: Record<Booking["status"], string> = {
  pending: "待確認",
  confirmed: "已確認",
  rejected: "已拒絕",
  cancelled: "已取消",
};

function detailRows(booking: Booking): string {
  const rows: [string, string | null | undefined][] = [
    ["訂單編號", booking.order_no],
    ["服務項目", booking.service_label],
    ["收費", booking.price_hkd != null ? `HK$${booking.price_hkd}` : "面議"],
    ["工人姓名", booking.worker_name],
  ];
  for (const [k, v] of Object.entries(booking.details || {})) {
    if (v) rows.push([k, v]);
  }
  return rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;color:#666;white-space:nowrap">${k}</td><td style="padding:6px 12px;font-weight:600">${v ?? "-"}</td></tr>`
    )
    .join("");
}

function wrapHtml(title: string, body: string): string {
  return `<!doctype html><html><body style="font-family:Helvetica,Arial,'PingFang HK',sans-serif;background:#f5f5f5;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#e8f1fd;padding:16px 24px;font-weight:700;color:#2d3339">Booking Demo — 服務預約通知</div>
    <div style="padding:24px">
      <h2 style="margin:0 0 16px;color:#2d3339">${title}</h2>
      ${body}
      <p style="color:#9499af;font-size:13px;margin-top:24px">此郵件由 Booking Demo 演示系統自動發出，僅作演示用途。</p>
    </div>
  </div>
</body></html>`;
}

async function send(to: string, subject: string, html: string): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn(`[booking] RESEND_API_KEY 未配置，跳過發送郵件：${subject} → ${to}`);
    return false;
  }
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) {
    console.error("[booking] 郵件發送失敗:", error);
    return false;
  }
  return true;
}

/** 發送登入驗證碼 */
export async function sendVerificationCodeEmail(
  to: string,
  code: string
): Promise<boolean> {
  const html = wrapHtml(
    "你嘅登入驗證碼",
    `<p style="font-size:32px;font-weight:700;letter-spacing:6px;text-align:center;color:#2d3339;margin:24px 0">${code}</p>
     <p style="text-align:center;color:#666">驗證碼 10 分鐘內有效，請勿轉發畀其他人。</p>`
  );
  return send(to, `【登入驗證碼】${code}`, html);
}

/** 管理員確認訂單後通知用戶 */
export async function sendConfirmedEmail(booking: Booking): Promise<boolean> {
  const html = wrapHtml(
    `預約已確認（${booking.order_no}）`,
    `<p>${booking.employer_name} 你好，你嘅「${booking.service_label}」預約已確認，我哋會盡快聯絡你安排後續事宜。</p>
     <table style="border-collapse:collapse;margin:16px 0">${detailRows(booking)}</table>`
  );
  return send(booking.email, `【預約已確認】${booking.service_label}（${booking.order_no}）`, html);
}

/** 管理員拒絕訂單後通知用戶（套票已自動退回賬戶） */
export async function sendRejectedEmail(booking: Booking): Promise<boolean> {
  const reason = booking.admin_note ? `<p>原因：${booking.admin_note}</p>` : "";
  const html = wrapHtml(
    `預約未能安排（${booking.order_no}）`,
    `<p>${booking.employer_name} 你好，好抱歉你嘅「${booking.service_label}」預約暫時未能安排，已用嘅套票已退回你嘅賬戶。${reason}</p>
     <p>如有疑問，歡迎聯絡我哋重新安排。</p>
     <table style="border-collapse:collapse;margin:16px 0">${detailRows(booking)}</table>`
  );
  return send(booking.email, `【預約未能安排】${booking.service_label}（${booking.order_no}）`, html);
}

/** 下單成功後向管理員發新訂單提醒（發到 EMAIL_FROM 同域名管理郵箱） */
export async function sendNewOrderNotice(booking: Booking): Promise<boolean> {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
  if (!adminEmail) return false;
  const html = wrapHtml(
    `新服務預約（${STATUS_TEXT[booking.status]}）`,
    `<p>收到新訂單，請盡快到後台確認：<a href="${process.env.NEXT_PUBLIC_SITE_URL || ""}/admin/bookings">管理後台</a></p>
     <table style="border-collapse:collapse;margin:16px 0">${detailRows(booking)}</table>
     <p>僱主：${booking.employer_name}（${booking.phone}${booking.whatsapp ? ` / WhatsApp ${booking.whatsapp}` : ""}）</p>`
  );
  return send(adminEmail, `【新訂單】${booking.service_label}（${booking.order_no}）`, html);
}
