import { createHash, randomBytes } from "crypto";
import { getSupabase } from "./db";

/**
 * 客戶端用戶體系：電郵 / 手機短訊 驗證碼登入（註冊/登入一體），兩種方式可互相綁定。
 * - 驗證碼：6 位數字，10 分鐘有效，用後即廢，同一標識 60 秒只能發一次
 * - 會話：隨機 token 存 customer_sessions 表，httpOnly cookie 攜帶，30 天有效
 * - 綁定：登入後可綁定 / 解綁電郵或手機，但必須至少保留一種（不可全部解綁）
 */

export const SESSION_COOKIE = "nl_session";
export const SESSION_DAYS = 30;
const CODE_TTL_MINUTES = 10;
const CODE_RESEND_SECONDS = 60;

/** 登入 / 綁定通道 */
export type Channel = "email" | "phone";

export interface Customer {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export function isChannel(v: unknown): v is Channel {
  return v === "email" || v === "phone";
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** 手機號歸一化為 E.164（無國碼時按香港 +852 處理） */
export function normalizePhone(raw: string): string {
  let p = (raw || "").trim().replace(/[\s\-()]/g, "");
  if (!p) return "";
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  if (!p.startsWith("+")) {
    const local = p.replace(/^852/, "");
    p = `+852${local}`;
  }
  return p;
}

export function isValidPhone(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

/** 依通道校驗並歸一化標識；無效返回 null */
export function normalizeIdentifier(
  channel: Channel,
  value: string
): string | null {
  if (channel === "email") {
    const email = normalizeEmail(value);
    return isValidEmail(email) ? email : null;
  }
  const phone = normalizePhone(value);
  return isValidPhone(phone) ? phone : null;
}

/** 標識顯示用脫敏（例：a***@gmail.com / +852 **** 5678） */
export function maskIdentifier(channel: Channel, value: string): string {
  if (channel === "email") {
    const [name, domain] = value.split("@");
    if (!domain) return value;
    return `${name.slice(0, 1)}${"*".repeat(Math.max(name.length - 1, 2))}@${domain}`;
  }
  return `${value.slice(0, 4)} **** ${value.slice(-4)}`;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** 生成並存儲驗證碼；返回 code 與錯誤（觸發頻率限制時） */
export async function createOtpCode(
  identifier: string,
  channel: Channel
): Promise<{ code?: string; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "服務暫時不可用" };

  const since = new Date(Date.now() - CODE_RESEND_SECONDS * 1000).toISOString();
  const { data: recent } = await supabase
    .from("otp_codes")
    .select("id")
    .eq("identifier", identifier)
    .eq("channel", channel)
    .gte("created_at", since)
    .limit(1);
  if (recent && recent.length > 0) {
    return { error: `發送太頻繁，請 ${CODE_RESEND_SECONDS} 秒後再試` };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
  const { error } = await supabase.from("otp_codes").insert({
    identifier,
    channel,
    code: hashCode(code),
    expires_at: expiresAt,
  });
  if (error) {
    console.error("[auth] 驗證碼寫入失敗:", error);
    return { error: "發送失敗，請稍後再試" };
  }
  return { code };
}

/** 校驗驗證碼並標記已用；通過返回 ok */
export async function verifyOtpCode(
  identifier: string,
  channel: Channel,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "服務暫時不可用" };

  const { data: rows } = await supabase
    .from("otp_codes")
    .select("id, expires_at, used")
    .eq("identifier", identifier)
    .eq("channel", channel)
    .eq("code", hashCode(code))
    .order("created_at", { ascending: false })
    .limit(1);

  const row = rows?.[0];
  if (!row) return { ok: false, error: "驗證碼錯誤" };
  if (row.used) return { ok: false, error: "驗證碼已使用，請重新獲取" };
  if (new Date(row.expires_at) < new Date()) return { ok: false, error: "驗證碼已過期，請重新獲取" };

  await supabase.from("otp_codes").update({ used: true }).eq("id", row.id);
  return { ok: true };
}

/** 依電郵或手機查找客戶 */
export async function findCustomerBy(
  channel: Channel,
  identifier: string
): Promise<Customer | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("customers")
    .select("id, email, phone, created_at")
    .eq(channel, identifier)
    .limit(1)
    .maybeSingle();
  return (data as Customer) || null;
}

/** 查找或建立客戶（首次驗證即自動開戶） */
export async function findOrCreateCustomer(
  channel: Channel,
  identifier: string
): Promise<{ customer?: Customer; error?: string }> {
  const existing = await findCustomerBy(channel, identifier);
  if (existing) return { customer: existing };

  const supabase = getSupabase();
  if (!supabase) return { error: "服務暫時不可用" };
  const payload: { email: string | null; phone: string | null } =
    channel === "email" ? { email: identifier, phone: null } : { phone: identifier, email: null };
  const { data: created, error } = await supabase
    .from("customers")
    .insert(payload)
    .select("id, email, phone, created_at")
    .single();
  if (error || !created) {
    console.error("[auth] 創建用戶失敗:", error);
    return { error: "登入失敗，請稍後再試" };
  }
  return { customer: created as Customer };
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("customers")
    .select("id, email, phone, created_at")
    .eq("id", id)
    .maybeSingle();
  return (data as Customer) || null;
}

/**
 * 綁定通道：把 identifier 綁到當前賬戶。
 * - 該標識已被其他賬戶使用 → 拒絕
 * - 當前賬戶該通道已綁定同一標識 → 直接成功
 */
export async function bindChannel(
  customerId: string,
  channel: Channel,
  identifier: string
): Promise<{ customer?: Customer; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "服務暫時不可用" };

  const owner = await findCustomerBy(channel, identifier);
  if (owner && owner.id !== customerId) {
    return { error: channel === "email" ? "該電郵已綁定其他賬戶" : "該手機號已綁定其他賬戶" };
  }

  const { data, error } = await supabase
    .from("customers")
    .update(channel === "email" ? { email: identifier } : { phone: identifier })
    .eq("id", customerId)
    .select("id, email, phone, created_at")
    .single();
  if (error || !data) {
    console.error("[auth] 綁定失敗:", error);
    return { error: "綁定失敗，請稍後再試" };
  }
  return { customer: data as Customer };
}

/** 解綁通道：必須至少保留另一種聯絡方式 */
export async function unbindChannel(
  customerId: string,
  channel: Channel
): Promise<{ customer?: Customer; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "服務暫時不可用" };

  const current = await getCustomerById(customerId);
  if (!current) return { error: "賬戶不存在" };
  const other: Channel = channel === "email" ? "phone" : "email";
  if (!current[other]) {
    return {
      error:
        channel === "email"
          ? "帳戶必須至少保留一種聯絡方式：請先綁定手機號，再解綁電郵"
          : "帳戶必須至少保留一種聯絡方式：請先綁定電郵，再解綁手機號",
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .update(channel === "email" ? { email: null } : { phone: null })
    .eq("id", customerId)
    .select("id, email, phone, created_at")
    .single();
  if (error || !data) {
    console.error("[auth] 解綁失敗:", error);
    return { error: "解綁失敗，請稍後再試" };
  }
  return { customer: data as Customer };
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

function tokenFromRequest(request: Request): string | null {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([a-f0-9]{64})`));
  return match ? match[1] : null;
}

/** 從請求 cookie 解析當前登入用戶（未登入返回 null） */
export async function getSessionCustomer(request: Request): Promise<Customer | null> {
  const token = tokenFromRequest(request);
  if (!token) return null;

  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("customer_sessions")
    .select("expires_at, customers(id, email, phone, created_at)")
    .eq("token", token)
    .limit(1)
    .maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return null;
  const c = data.customers as unknown as Customer | null;
  return c || null;
}

/** 註銷會話 */
export async function destroySession(request: Request): Promise<void> {
  const token = tokenFromRequest(request);
  if (!token) return;
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from("customer_sessions").delete().eq("token", token);
}

/** 寫入登入 cookie 的 Set-Cookie 頭 */
export function sessionCookieHeader(token: string, expires: Date): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${secure}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
