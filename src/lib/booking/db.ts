import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase service-role client（僅服務端使用，切勿導入客戶端組件）。
 * 未配置環境變量時返回 null，由調用方決定降級行為（API 返回 503）。
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "booking-files";

/** 訂單記錄（對應 bookings 表） */
export interface Booking {
  id: string;
  order_no: string;
  service_key: string;
  service_label: string;
  price_hkd: number | null;
  employer_name: string;
  phone: string;
  whatsapp: string | null;
  email: string;
  worker_name: string;
  details: Record<string, string>;
  remark: string | null;
  files: { name: string; path: string; size: number }[];
  status: "pending" | "confirmed" | "rejected" | "cancelled";
  customer_id: string | null;
  payment_status: "none" | "pending" | "paid" | "refunded";
  stripe_session_id: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

/** 人讀單號：BK20260918-XXXX */
export function generateOrderNo(): string {
  const now = new Date();
  const hk = new Date(now.getTime() + 8 * 3600 * 1000);
  const ymd = hk.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BK${ymd}-${rand}`;
}
