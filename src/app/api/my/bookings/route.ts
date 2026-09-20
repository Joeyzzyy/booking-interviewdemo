import { getSessionCustomer } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";

export const dynamic = "force-dynamic";

/** GET /api/my/bookings — 當前登入用戶的訂單列表（不含管理員備註等內部字段） */
export async function GET(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "服務暫時不可用" }, { status: 503 });
  }
  const { data, error } = await supabase
    .from("bookings")
    .select("id, order_no, service_label, price_hkd, worker_name, status, payment_status, created_at")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[my/bookings] 讀取失敗:", error);
    return Response.json({ error: "讀取失敗" }, { status: 500 });
  }
  return Response.json(
    { bookings: data || [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}
