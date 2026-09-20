import type { Customer } from "./auth";
import type { ServiceItem } from "./services";

/**
 * Stripe 付款（套票購買）。
 * STRIPE_SECRET_KEY 未配置時 isStripeEnabled()=false，前端會顯示「即將開通」提示。
 * 付款成功由 /api/stripe/webhook 回填 pass_orders 並入賬套票。
 */

export function isStripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * 為套票購買創建 Stripe Checkout Session，返回付款頁 URL。
 */
export async function createPassCheckoutSession(params: {
  passOrderId: string;
  customer: Customer;
  service: ServiceItem;
  quantity: 1 | 10;
  amountHkd: number;
}): Promise<{ id: string; url: string | null } | null> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(secret);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://oneplusemployment.com";
  const { passOrderId, customer, service, quantity, amountHkd } = params;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "hkd",
          unit_amount: amountHkd * 100,
          product_data: {
            name: `${service.label}套票 × ${quantity}`,
            description: service.description,
          },
        },
      },
    ],
    customer_email: customer.email,
    metadata: {
      passOrderId,
      customerId: customer.id,
      serviceKey: service.key,
      quantity: String(quantity),
    },
    success_url: `${siteUrl}/booking?purchase=success`,
    cancel_url: `${siteUrl}/booking?purchase=cancelled`,
  });
  return { id: session.id, url: session.url };
}
