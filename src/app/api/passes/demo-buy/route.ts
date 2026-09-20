import { getSessionCustomer } from "@/lib/booking/auth";
import { creditPasses, getBalances } from "@/lib/booking/passes";
import { SERVICES } from "@/lib/booking/services";

export const dynamic = "force-dynamic";

/**
 * POST /api/passes/demo-buy — 試用領取模擬套票（演示用）。
 * 每種服務領 2 張；正式 Stripe 購票開通後此接口自動停用（403）。
 */
export async function POST(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }
  if (process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: "正式購票已開通，請透過付款購買套票" }, { status: 403 });
  }

  let ok = true;
  for (const s of SERVICES) {
    ok = (await creditPasses(customer.id, s.key, 2)) && ok;
  }
  if (!ok) {
    return Response.json({ error: "領取失敗，請稍後再試" }, { status: 500 });
  }

  const balances = await getBalances(customer.id);
  return Response.json({ balances }, { status: 201 });
}
