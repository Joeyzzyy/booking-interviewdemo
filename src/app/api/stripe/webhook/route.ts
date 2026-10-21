import { getSupabase } from "@/lib/booking/db";
import { creditPasses } from "@/lib/booking/passes";
import { syncSubscription, type InterviewPlanKey } from "@/lib/interview/plans";

export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/webhook — Stripe 付款回調。
 *
 * 接入步驟：
 * 1. Stripe Dashboard → Developers → Webhooks → Add endpoint：
 *    URL = https://<你的域名>/api/stripe/webhook
 *    監聽事件 = checkout.session.completed + customer.subscription.created/updated/deleted
 * 2. 把 Signing secret 填進環境變量 STRIPE_WEBHOOK_SECRET
 * 3. STRIPE_SECRET_KEY 填好後，套票購買 + 訂閱全鏈路自動生效
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) {
    return Response.json({ error: "Stripe 未配置" }, { status: 503 });
  }

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(secret);
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe] webhook 簽名校驗失敗:", err);
    return Response.json({ error: "簽名校驗失敗" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { passOrderId, customerId, serviceKey, quantity } = session.metadata || {};
    if (!passOrderId || !customerId || !serviceKey || !quantity) {
      console.error("[stripe] webhook 缺少 metadata:", session.id);
      return Response.json({ received: true });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return Response.json({ error: "數據庫未配置" }, { status: 503 });
    }

    // 防重複入賬：只處理 pending 訂單（webhook 可能重試）
    const { data: order } = await supabase
      .from("pass_orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", passOrderId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!order) {
      console.log(`[stripe] pass_order ${passOrderId} 已處理過，跳過`);
      return Response.json({ received: true });
    }

    const ok = await creditPasses(customerId, serviceKey, parseInt(quantity, 10));
    if (!ok) {
      // 入賬失敗要讓 Stripe 重試
      console.error(`[stripe] pass_order ${passOrderId} 入賬失敗`);
      return Response.json({ error: "入賬失敗" }, { status: 500 });
    }
    console.log(`[stripe] pass_order ${passOrderId} 入賬 ${quantity} 張 ${serviceKey}`);
    return Response.json({ received: true });
  }

  // ---- 月費訂閱（AI 面試 Basic / Advanced）：訂閱狀態同步 ----
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object;
    const { customerId, plan } = (sub.metadata || {}) as { customerId?: string; plan?: string };
    if (!customerId || (plan !== "basic" && plan !== "advanced")) {
      console.error("[stripe] subscription webhook 缺少 metadata:", sub.id);
      return Response.json({ received: true });
    }
    const status =
      event.type === "customer.subscription.deleted"
        ? "canceled"
        : sub.cancel_at_period_end
          ? "canceling"
          : "active";
    const ok = await syncSubscription({
      customerId,
      plan: plan as InterviewPlanKey,
      status,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: new Date((sub as { current_period_end?: number }).current_period_end || Date.now()).toISOString(),
    });
    if (!ok) {
      // 同步失敗要讓 Stripe 重試
      return Response.json({ error: "訂閱同步失敗" }, { status: 500 });
    }
    console.log(`[stripe] subscription ${sub.id} → ${status} (${plan})`);

    // 升級語義：同用戶其他生效中訂閱立即取消（避免 Basic + Advanced 雙重扣費）
    if (status === "active") {
      const supabase = getSupabase();
      if (supabase) {
        const { data: others } = await supabase
          .from("subscriptions")
          .select("id, stripe_subscription_id")
          .eq("customer_id", customerId)
          .in("status", ["active", "canceling"])
          .neq("stripe_subscription_id", sub.id);
        for (const o of others || []) {
          const sid = o.stripe_subscription_id as string;
          try {
            await stripe.subscriptions.cancel(sid);
            await supabase.from("subscriptions").update({ status: "canceled" }).eq("id", o.id);
            console.log(`[stripe] 升級：已取消舊訂閱 ${sid}`);
          } catch (e) {
            console.error(`[stripe] 取消舊訂閱 ${sid} 失敗:`, e);
          }
        }
      }
    }
  }

  return Response.json({ received: true });
}
