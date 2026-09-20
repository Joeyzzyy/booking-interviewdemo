import { getSupabase } from "./db";

/**
 * 套票餘額管理（pass_credits 表：每用戶 × 服務一行，total/used 計數）。
 * - 購買入賬：Stripe webhook 付款成功後 creditPasses
 * - 下單核銷：consumeCredit（單條件 UPDATE，used<total 才成功，避免超扣）
 * - 訂單被拒絕/用戶取消：refundCredit 退回 1 張
 */

export interface PassBalance {
  serviceKey: string;
  total: number;
  used: number;
  remaining: number;
}

export async function getBalances(customerId: string): Promise<PassBalance[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("pass_credits")
    .select("service_key, total, used")
    .eq("customer_id", customerId);
  return (data || []).map((r) => ({
    serviceKey: r.service_key as string,
    total: r.total as number,
    used: r.used as number,
    remaining: (r.total as number) - (r.used as number),
  }));
}

/** 付款成功後入賬 quantity 張套票（冇記錄則新建） */
export async function creditPasses(
  customerId: string,
  serviceKey: string,
  quantity: number
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data: existing } = await supabase
    .from("pass_credits")
    .select("total")
    .eq("customer_id", customerId)
    .eq("service_key", serviceKey)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("pass_credits")
        .update({
          total: (existing.total as number) + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq("customer_id", customerId)
        .eq("service_key", serviceKey)
    : await supabase.from("pass_credits").insert({
        customer_id: customerId,
        service_key: serviceKey,
        total: quantity,
        used: 0,
      });
  if (error) {
    console.error("[passes] 入賬失敗:", error);
    return false;
  }
  return true;
}

/** 核銷 1 張：餘額不足返回 false（單條件 UPDATE，避免並發超扣） */
export async function consumeCredit(
  customerId: string,
  serviceKey: string
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase
    .rpc("consume_pass_credit", { p_customer_id: customerId, p_service_key: serviceKey });
  if (error) {
    console.error("[passes] 核銷失敗:", error);
    return false;
  }
  return Boolean(data);
}

/** 退回 1 張（拒絕/取消訂單時） */
export async function refundCredit(
  customerId: string,
  serviceKey: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .rpc("refund_pass_credit", { p_customer_id: customerId, p_service_key: serviceKey });
  if (error) {
    console.error("[passes] 退回失敗:", error);
  }
}
