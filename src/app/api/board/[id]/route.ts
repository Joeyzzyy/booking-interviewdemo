import { getSessionCustomer } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";

export const dynamic = "force-dynamic";

/** DELETE /api/board/[id] — 刪除帖子（作者本人或管理員） */
export async function DELETE(
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
  const { data: post } = await supabase
    .from("board_posts")
    .select("customer_id")
    .eq("id", id)
    .maybeSingle();
  if (!post) {
    return Response.json({ error: "帖子不存在" }, { status: 404 });
  }
  if (post.customer_id !== customer.id && !customer.is_admin) {
    return Response.json({ error: "只能刪除自己的帖子" }, { status: 403 });
  }

  const { error } = await supabase.from("board_posts").delete().eq("id", id);
  if (error) {
    console.error("[board] 刪除失敗:", error);
    return Response.json({ error: "刪除失敗，請稍後再試" }, { status: 500 });
  }
  return Response.json({ ok: true });
}

/** PATCH /api/board/[id] — 置頂 / 取消置頂（僅管理員）body: { action: "pin" | "unpin" } */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = await getSessionCustomer(request);
  if (!customer) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }
  if (!customer.is_admin) {
    return Response.json({ error: "只有管理員可以置頂帖子" }, { status: 403 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "服務暫時不可用" }, { status: 503 });
  }

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  if (body.action !== "pin" && body.action !== "unpin") {
    return Response.json({ error: "參數錯誤" }, { status: 400 });
  }

  const { id } = await params;
  const { error } = await supabase
    .from("board_posts")
    .update({ pinned: body.action === "pin" })
    .eq("id", id);
  if (error) {
    console.error("[board] 置頂更新失敗:", error);
    return Response.json({ error: "操作失敗，請稍後再試" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
