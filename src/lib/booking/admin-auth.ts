import { createHmac, timingSafeEqual } from "crypto";

/**
 * 管理後台密碼門禁（僅服務端）。
 * - 密碼來自環境變量 ADMIN_PASSWORD（未配置時默認 admin@2026，演示用，上線務必修改）
 * - 驗證通過後簽發 HMAC 簽名 token 存 httpOnly cookie（12 小時有效）
 * - token 簽名材料含密碼本身：改密碼後所有已簽發 token 即失效
 */

export const ADMIN_COOKIE = "nl_admin";
const TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12 小時

export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "admin@2026";
}

function signingSecret(): string {
  return `nl-admin|${adminPassword()}|${process.env.SUPABASE_SERVICE_ROLE_KEY || ""}`;
}

/** 常量時間比較密碼 */
export function verifyAdminPassword(pw: string): boolean {
  const a = Buffer.from(String(pw));
  const b = Buffer.from(adminPassword());
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("hex");
}

export function createAdminToken(): string {
  const exp = String(Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS);
  return `${exp}.${sign(exp)}`;
}

export function verifyAdminToken(token: string): boolean {
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp) || !/^[a-f0-9]{64}$/.test(sig)) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

function tokenFromRequest(request: Request): string | null {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=(\\d+\\.[a-f0-9]{64})`));
  return match ? match[1] : null;
}

/** 請求是否已通過管理後台門禁 */
export function isAdminRequest(request: Request): boolean {
  const token = tokenFromRequest(request);
  return token ? verifyAdminToken(token) : false;
}

/** 401 響應（各 /api/admin/* 路由統一使用） */
export function adminUnauthorized(): Response {
  return Response.json({ error: "未授權，請先登入管理後台" }, { status: 401 });
}

export function adminCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TOKEN_TTL_SECONDS}${secure}`;
}

export function clearAdminCookieHeader(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
