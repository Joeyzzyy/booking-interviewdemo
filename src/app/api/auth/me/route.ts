import { getSessionCustomer } from "@/lib/booking/auth";

export const dynamic = "force-dynamic";

/** GET /api/auth/me — 當前登入用戶（未登入返回 { customer: null }） */
export async function GET(request: Request) {
  const customer = await getSessionCustomer(request);
  return Response.json({
    customer: customer ? { email: customer.email } : null,
  });
}
