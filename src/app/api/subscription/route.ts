import { getSessionCustomer } from "@/lib/booking/auth";
import { cancelStripeSubscription } from "@/lib/booking/stripe-sub";
import { getSubscription, getActiveSubscription } from "@/lib/interview/plans";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription — 當前用戶訂閱狀態
 * DELETE /api/subscription — 取消訂閱（本期結束時失效）
 */
export async function GET(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) return Response.json({ error: "請先登入" }, { status: 401 });
  const sub = await getSubscription(customer.id);
  const active = await getActiveSubscription(customer.id);
  return Response.json({ subscription: sub, active: Boolean(active) });
}

export async function DELETE(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) return Response.json({ error: "請先登入" }, { status: 401 });
  const sub = await getActiveSubscription(customer.id);
  if (!sub?.stripeSubscriptionId) {
    return Response.json({ error: "沒有有效的訂閱" }, { status: 400 });
  }
  const ok = await cancelStripeSubscription(sub.stripeSubscriptionId);
  if (!ok) return Response.json({ error: "取消失敗，請稍後再試" }, { status: 500 });
  return Response.json({ ok: true });
}
