import type { Customer } from "./auth";
import { INTERVIEW_PLANS, type InterviewPlanKey } from "@/lib/interview/plans";

/**
 * Stripe 月費訂閱（AI 面試 Basic / Advanced 計劃）。
 * 價格用 inline price_data（recurring month）動態創建，無需在 Dashboard 預建 Price。
 * 訂閱狀態由 /api/stripe/webhook 的 customer.subscription.* 事件同步落庫。
 *
 * 內部低價測試：設置 STRIPE_SUB_TEST_PRICE_HKD（如 1）後，兩個計劃的結賬金額
 * 都改為該值（metadata.plan 不變，webhook 同步 / 升級互斥照常），便於低成本走通
 * 訂閱全鏈路。測試完務必刪除該環境變量，否則所有用戶都按測試價扣款。
 */

/** 創建訂閱 Checkout Session，返回付款頁 URL */
export async function createSubscriptionCheckoutSession(params: {
  customer: Customer;
  plan: InterviewPlanKey;
}): Promise<{ id: string; url: string | null } | null> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(secret);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { customer, plan } = params;
  const planDef = INTERVIEW_PLANS[plan];
  const name = plan === "advanced" ? "AI 面試 Advanced Plan（自製 CV）" : "AI 面試 Basic Plan（核實 CV）";

  // 測試價覆蓋：環境變量為正數時生效（兩個計劃同價）
  const testPrice = Number(process.env.STRIPE_SUB_TEST_PRICE_HKD);
  const priceHkd = Number.isFinite(testPrice) && testPrice > 0 ? testPrice : planDef.priceHkd;
  if (priceHkd !== planDef.priceHkd) {
    console.warn(`[subscription] 測試價生效：${plan} 以 HK$${priceHkd} 結賬（原價 HK$${planDef.priceHkd}）`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "hkd",
          unit_amount: priceHkd * 100,
          recurring: { interval: "month" },
          product_data: { name },
        },
      },
    ],
    ...(customer.email ? { customer_email: customer.email } : {}),
    // metadata 落到 Subscription 對象上，webhook 憑此識別用戶/計劃
    subscription_data: {
      metadata: { customerId: customer.id, plan },
    },
    success_url: `${siteUrl}/booking?tab=create&sub=success`,
    cancel_url: `${siteUrl}/booking?tab=create&sub=cancelled`,
  });
  return { id: session.id, url: session.url };
}

/** 取消訂閱（本期結束時失效） */
export async function cancelStripeSubscription(stripeSubscriptionId: string): Promise<boolean> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return false;
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(secret);
  try {
    await stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
    return true;
  } catch (e) {
    console.error("[subscription] Stripe 取消失敗:", e);
    return false;
  }
}
