import { createHash, randomBytes } from "crypto";
import { getSupabase } from "./db";

/**
 * 客戶端用戶體系：郵箱驗證碼登入（註冊/登入一體）。
 * - 驗證碼：6 位數字，10 分鐘有效，用後即廢，每郵箱 60 秒只能發一次
 * - 會話：隨機 token 存 customer_sessions 表，httpOnly cookie 攜帶，30 天有效
 */

export const SESSION_COOKIE = "op_session";
export const SESSION_DAYS = 30;
const CODE_TTL_MINUTES = 10;
const CODE_RESEND_SECONDS = 60;

export interface Customer {
  id: string;
  email: string;
  created_at: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** 生成並存儲驗證碼；返回 code 與錯誤（觸發頻率限制時） */
export async function createEmailCode(
  email: string
): Promise<{ code?: string; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "服務暫時不可用" };

  // 頻率限制：60 秒內已發過
  const since = new Date(Date.now() - CODE_RESEND_SECONDS * 1000).toISOString();
  const { data: recent } = await supabase
    .from("email_codes")
    .select("id")
    .eq("email", email)
    .gte("created_at", since)
    .limit(1);
  if (recent && recent.length > 0) {
    return { error: `發送太頻繁，請 ${CODE_RESEND_SECONDS} 秒後再試` };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
  const { error } = await supabase.from("email_codes").insert({
    email,
    code: hashCode(code),
    expires_at: expiresAt,
  });
  if (error) {
    console.error("[auth] 驗證碼寫入失敗:", error);
    return { error: "發送失敗，請稍後再試" };
  }
  return { code };
}

/** 校驗驗證碼；成功返回 customer 並標記驗證碼已用 */
export async function verifyEmailCode(
  email: string,
  code: string
): Promise<{ customer?: Customer; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "服務暫時不可用" };

  const { data: rows } = await supabase
    .from("email_codes")
    .select("id, expires_at, used")
    .eq("email", email)
    .eq("code", hashCode(code))
    .order("created_at", { ascending: false })
    .limit(1);

  const row = rows?.[0];
  if (!row) return { error: "驗證碼錯誤" };
  if (row.used) return { error: "驗證碼已使用，請重新獲取" };
  if (new Date(row.expires_at) < new Date()) return { error: "驗證碼已過期，請重新獲取" };

  await supabase.from("email_codes").update({ used: true }).eq("id", row.id);

  // 查找或創建 customer
  const { data: existing } = await supabase
    .from("customers")
    .select("*")
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  if (existing) return { customer: existing as Customer };

  const { data: created, error } = await supabase
    .from("customers")
    .insert({ email })
    .select()
    .single();
  if (error || !created) {
    console.error("[auth] 創建用戶失敗:", error);
    return { error: "登入失敗，請稍後再試" };
  }
  return { customer: created as Customer };
}

/** 創建會話，返回 token 與過期時間 */
export async function createSession(
  customerId: string
): Promise<{ token: string; expires: Date } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  const { error } = await supabase.from("customer_sessions").insert({
    token,
    customer_id: customerId,
    expires_at: expires.toISOString(),
  });
  if (error) {
    console.error("[auth] 創建會話失敗:", error);
    return null;
  }
  return { token, expires };
}

/** 從請求 cookie 解析當前登入用戶（未登入返回 null） */
export async function getSessionCustomer(request: Request): Promise<Customer | null> {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([a-f0-9]{64})`));
  if (!match) return null;

  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("customer_sessions")
    .select("expires_at, customers(id, email, created_at)")
    .eq("token", match[1])
    .limit(1)
    .maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return null;
  const c = data.customers as unknown as Customer | null;
  return c || null;
}

/** 註銷會話 */
export async function destroySession(request: Request): Promise<void> {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([a-f0-9]{64})`));
  if (!match) return;
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from("customer_sessions").delete().eq("token", match[1]);
}

/** 寫入登入 cookie 的 Set-Cookie 頭 */
export function sessionCookieHeader(token: string, expires: Date): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${secure}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
