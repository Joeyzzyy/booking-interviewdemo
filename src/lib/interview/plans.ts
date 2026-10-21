import { getSupabase } from "@/lib/booking/db";

/**
 * AI 面試月費訂閱（subscriptions 表，Stripe subscription 驅動）。
 *
 * - Basic（核實 CV）：HK$199/月 —— 現有 72 題 CV 核實面試
 * - Advanced（自製 CV）：HK$399/月 —— 自選 8 個測試章節 + 作答生成 CV
 * - 狀態同步：/api/stripe/webhook 監聽 customer.subscription.* 事件
 */

export type InterviewPlanKey = "basic" | "advanced";

export interface InterviewPlan {
  key: InterviewPlanKey;
  priceHkd: number;
}

export const INTERVIEW_PLANS: Record<InterviewPlanKey, InterviewPlan> = {
  basic: { key: "basic", priceHkd: 199 },
  advanced: { key: "advanced", priceHkd: 399 },
};

export function isInterviewPlan(v: unknown): v is InterviewPlanKey {
  return v === "basic" || v === "advanced";
}

export interface Subscription {
  plan: InterviewPlanKey;
  status: "active" | "canceling" | "canceled";
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string;
}

/** 用戶最新一條訂閱（不論狀態） */
export async function getSubscription(customerId: string): Promise<Subscription | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, stripe_subscription_id, current_period_end")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    plan: data.plan as InterviewPlanKey,
    status: data.status as Subscription["status"],
    stripeSubscriptionId: (data.stripe_subscription_id as string) || null,
    currentPeriodEnd: data.current_period_end as string,
  };
}

/** 有效訂閱：status=active 且未過期；無則返回 null */
export async function getActiveSubscription(customerId: string): Promise<Subscription | null> {
  const sub = await getSubscription(customerId);
  if (!sub) return null;
  const active = sub.status === "active" && new Date(sub.currentPeriodEnd).getTime() > Date.now();
  return active ? sub : null;
}

/** webhook 同步用：按 Stripe subscription 落庫（冇則建、有則更新） */
export async function syncSubscription(params: {
  customerId: string;
  plan: InterviewPlanKey;
  status: Subscription["status"];
  stripeSubscriptionId: string;
  currentPeriodEnd: string;
}): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", params.stripeSubscriptionId)
    .maybeSingle();
  const payload = {
    customer_id: params.customerId,
    plan: params.plan,
    status: params.status,
    stripe_subscription_id: params.stripeSubscriptionId,
    current_period_end: params.currentPeriodEnd,
    updated_at: new Date().toISOString(),
  };
  const { error } = existing
    ? await supabase.from("subscriptions").update(payload).eq("id", existing.id)
    : await supabase.from("subscriptions").insert(payload);
  if (error) {
    console.error("[subscription] 同步失敗:", error);
    return false;
  }
  return true;
}
