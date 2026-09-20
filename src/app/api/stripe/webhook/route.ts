import { getSupabase } from "@/lib/booking/db";
import { creditPasses } from "@/lib/booking/passes";

export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/webhook — Stripe 付款回調。
 *
 * 接入步驟：
 * 1. Stripe Dashboard → Developers → Webhooks → Add endpoint：
 *    URL = https://<你的域名>/api/stripe/webhook
 *    監聽事件 = checkout.session.completed
 * 2. 把 Signing secret 填進環境變量 STRIPE_WEBHOOK_SECRET
 * 3. STRIPE_SECRET_KEY 填好後，套票購買全鏈路自動生效
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
  }

  return Response.json({ received: true });
}
