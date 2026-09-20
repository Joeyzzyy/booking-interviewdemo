import { getSessionCustomer } from "@/lib/booking/auth";
import { getBalances } from "@/lib/booking/passes";

export const dynamic = "force-dynamic";

/** GET /api/my/passes — 當前用戶各服務套票餘額 */
export async function GET(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }
  const balances = await getBalances(customer.id);
  return Response.json(
    { balances },
    { headers: { "Cache-Control": "no-store" } }
  );
}
