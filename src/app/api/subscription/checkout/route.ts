import { getSessionCustomer } from "@/lib/booking/auth";
import { createSubscriptionCheckoutSession } from "@/lib/booking/stripe-sub";
import { INTERVIEW_PLANS, isInterviewPlan } from "@/lib/interview/plans";

export const dynamic = "force-dynamic";

/**
 * POST /api/subscription/checkout
 * body: { plan: "basic" | "advanced" }
 * 創建 Stripe 月費訂閱 Checkout Session，返回付款頁 URL。
 */
export async function POST(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) {
    return Response.json({ error: "請先登入", code: "LOGIN_REQUIRED" }, { status: 401 });
  }

  let body: { plan?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  if (!isInterviewPlan(body.plan)) {
    return Response.json({ error: "請選擇訂閱計劃", code: "PLAN_REQUIRED" }, { status: 400 });
  }

  const session = await createSubscriptionCheckoutSession({ customer, plan: body.plan });
  if (!session?.url) {
    return Response.json(
      { error: "線上付款未開通，請 WhatsApp 9522 3881 聯絡我哋訂閱", code: "PAYMENT_UNAVAILABLE" },
      { status: 503 }
    );
  }
  return Response.json({ url: session.url, plan: body.plan, priceHkd: INTERVIEW_PLANS[body.plan].priceHkd });
}
