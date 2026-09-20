import { getSupabase, type Booking } from "@/lib/booking/db";
import { sendConfirmedEmail, sendRejectedEmail } from "@/lib/booking/email";
import { refundCredit } from "@/lib/booking/passes";
import { checkAdminAuth } from "../route";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/bookings/[id]
 * body: { action: "confirm" | "reject", adminNote?: string }
 * 確認：置 confirmed → （Stripe 已配置則生成付款鏈接）→ 發確認郵件
 * 拒絕：置 rejected → 發拒絕郵件
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAdminAuth(request)) {
    return Response.json({ error: "未授權" }, { status: 401 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "數據庫未配置" }, { status: 503 });
  }

  const { id } = await params;
  let body: { action?: string; adminNote?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  if (body.action !== "confirm" && body.action !== "reject") {
    return Response.json({ error: "未知操作" }, { status: 400 });
  }

  const { data: existing, error: readErr } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .single();
  if (readErr || !existing) {
    return Response.json({ error: "訂單不存在" }, { status: 404 });
  }
  const booking = existing as Booking;
  if (booking.status !== "pending") {
    return Response.json({ error: "訂單已處理，請刷新列表" }, { status: 409 });
  }

  const nextStatus = body.action === "confirm" ? "confirmed" : "rejected";
  const { error: updErr } = await supabase
    .from("bookings")
    .update({
      status: nextStatus,
      admin_note: body.adminNote?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updErr) {
    console.error("[admin] 更新訂單失敗:", updErr);
    return Response.json({ error: "更新失敗" }, { status: 500 });
  }
  const updated: Booking = {
    ...booking,
    status: nextStatus,
    admin_note: body.adminNote?.trim() || null,
  };

  // 拒絕時退回已核銷的套票
  if (nextStatus === "rejected" && booking.customer_id) {
    await refundCredit(booking.customer_id, booking.service_key);
  }

  // 套票已預付，確認郵件不再附付款鏈接
  const emailSent =
    nextStatus === "confirmed"
      ? await sendConfirmedEmail(updated).catch(() => false)
      : await sendRejectedEmail(updated).catch(() => false);

  return Response.json({ ok: true, status: nextStatus, emailSent });
}
