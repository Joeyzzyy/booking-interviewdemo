import type { Customer } from "./auth";
import { INTERVIEW_PLANS, type InterviewPlanKey } from "@/lib/interview/plans";

/**
 * Stripe 月費訂閱（AI 面試 Basic / Advanced 計劃）。
 * 價格用 inline price_data（recurring month）動態創建，無需在 Dashboard 預建 Price。
 * 訂閱狀態由 /api/stripe/webhook 的 customer.subscription.* 事件同步落庫。
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

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "hkd",
          unit_amount: planDef.priceHkd * 100,
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
