import { getSessionCustomer } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";
import { getService } from "@/lib/booking/services";
import { createPassCheckoutSession } from "@/lib/booking/stripe";

export const dynamic = "force-dynamic";

/**
 * POST /api/passes/checkout
 * body: { serviceKey, quantity: 1 | 10 }
 * 建 pass_order（pending）→ 創建 Stripe Checkout Session → 返回付款頁 URL。
 */
export async function POST(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "服務暫時不可用" }, { status: 503 });
  }

  let body: { serviceKey?: string; quantity?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  const service = getService(body.serviceKey || "");
  const quantity = body.quantity === 10 ? 10 : body.quantity === 1 ? 1 : null;
  if (!service || !quantity) {
    return Response.json({ error: "請選擇服務及套票數量" }, { status: 400 });
  }
  const amountHkd = quantity === 10 ? service.pricePack10 : service.priceSingle;

  // 1) 建待付款訂單
  const { data: order, error: insertErr } = await supabase
    .from("pass_orders")
    .insert({
      customer_id: customer.id,
      service_key: service.key,
      quantity,
      amount_hkd: amountHkd,
      status: "pending",
    })
    .select()
    .single();
  if (insertErr || !order) {
    console.error("[passes] 建訂單失敗:", insertErr);
    return Response.json({ error: "創建訂單失敗，請稍後再試" }, { status: 500 });
  }

  // 2) Stripe Checkout
  let session: { id: string; url: string | null } | null = null;
  try {
    session = await createPassCheckoutSession({
      passOrderId: order.id,
      customer,
      service,
      quantity,
      amountHkd,
    });
  } catch (e) {
    console.error("[passes] Stripe session 失敗:", e);
  }
  if (!session?.url) {
    return Response.json(
      { error: "線上付款未開通，請 WhatsApp 9522 3881 聯絡我哋購買" },
      { status: 503 }
    );
  }

  await supabase
    .from("pass_orders")
    .update({ stripe_session_id: session.id })
    .eq("id", order.id);

  return Response.json({ url: session.url });
}
