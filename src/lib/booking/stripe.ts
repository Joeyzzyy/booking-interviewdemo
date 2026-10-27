import type { Customer } from "./auth";
import type { ServiceItem } from "./services";

/**
 * Stripe 付款（套票購買）。
 * STRIPE_SECRET_KEY 未配置時 isStripeEnabled()=false，前端會顯示「即將開通」提示。
 * 付款成功由 /api/stripe/webhook 回填 pass_orders 並入賬套票。
 *
 * 內部低價測試：設置 STRIPE_PASS_TEST_PRICE_HKD（如 1）後，套票結賬金額改為該值
 * （pass_orders.amount_hkd 同步記測試價）。測試完務必刪除該環境變量。
 */

export function isStripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** 測試價覆蓋：環境變量為正數時生效，否則返回原價 */
export function resolvePassPriceHkd(defaultHkd: number): number {
  const testPrice = Number(process.env.STRIPE_PASS_TEST_PRICE_HKD);
  const price = Number.isFinite(testPrice) && testPrice > 0 ? testPrice : defaultHkd;
  if (price !== defaultHkd) {
    console.warn(`[passes] 測試價生效：套票以 HK$${price} 結賬（原價 HK$${defaultHkd}）`);
  }
  return price;
}

/**
 * 為套票購買創建 Stripe Checkout Session，返回付款頁 URL。
 */
export async function createPassCheckoutSession(params: {
  passOrderId: string;
  customer: Customer;
  service: ServiceItem;
  amountHkd: number;
}): Promise<{ id: string; url: string | null } | null> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(secret);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { passOrderId, customer, service } = params;
  // 防漏：即使調用方沒做覆蓋，這裡也兜底攔一次，保證實扣金額不會是原價
  const amountHkd = resolvePassPriceHkd(params.amountHkd);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "hkd",
          unit_amount: amountHkd * 100,
          product_data: {
            name: `${service.label}套票`,
            description: service.description,
          },
        },
      },
    ],
    // 付款頁顯示優惠碼輸入框；折扣券在 Stripe Dashboard / API 管理，無需改代碼
    allow_promotion_codes: true,
    // 賬戶可能只綁定了手機號：無電郵時交由 Stripe 於付款頁收集
    ...(customer.email ? { customer_email: customer.email } : {}),
    metadata: {
      passOrderId,
      customerId: customer.id,
      serviceKey: service.key,
      quantity: "1",
    },
    success_url: `${siteUrl}/booking?purchase=success`,
    cancel_url: `${siteUrl}/booking?purchase=cancelled`,
  });
  return { id: session.id, url: session.url };
}
