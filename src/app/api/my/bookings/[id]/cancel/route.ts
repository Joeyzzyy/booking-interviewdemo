import { getSessionCustomer } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";
import { refundCredit } from "@/lib/booking/passes";

export const dynamic = "force-dynamic";

/**
 * POST /api/my/bookings/[id]/cancel
 * 用戶取消自己的待確認訂單。僅限 status=pending 且屬於當前登入賬號。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = await getSessionCustomer(request);
  if (!customer) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "服務暫時不可用" }, { status: 503 });
  }

  const { id } = await params;
  // 同時校驗歸屬與狀態，避免越權/重複操作
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("customer_id", customer.id)
    .eq("status", "pending")
    .select("id");

  if (error) {
    console.error("[my/bookings] 取消失敗:", error);
    return Response.json({ error: "取消失敗，請稍後再試" }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return Response.json({ error: "訂單不存在或已處理，無法取消" }, { status: 409 });
  }

  // 退回已核銷的套票
  const { data: booking } = await supabase
    .from("bookings")
    .select("customer_id, service_key")
    .eq("id", id)
    .single();
  if (booking?.customer_id) {
    await refundCredit(booking.customer_id, booking.service_key);
  }
  return Response.json({ ok: true });
}
