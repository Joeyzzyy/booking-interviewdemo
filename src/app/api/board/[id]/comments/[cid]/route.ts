import { getSessionCustomer } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";

export const dynamic = "force-dynamic";

/** DELETE /api/board/[id]/comments/[cid] — 刪除留言（留言者本人 / 帖主 / 管理員） */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const customer = await getSessionCustomer(request);
  if (!customer) {
    return Response.json({ error: "請先登入" }, { status: 401 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "服務暫時不可用" }, { status: 503 });
  }

  const { id, cid } = await params;
  const { data: comment } = await supabase
    .from("board_comments")
    .select("customer_id, post_id")
    .eq("id", cid)
    .eq("post_id", id)
    .maybeSingle();
  if (!comment) {
    return Response.json({ error: "留言不存在" }, { status: 404 });
  }

  const { data: post } = await supabase
    .from("board_posts")
    .select("customer_id")
    .eq("id", id)
    .maybeSingle();
  const isPostAuthor = post?.customer_id === customer.id;
  if (comment.customer_id !== customer.id && !isPostAuthor && !customer.is_admin) {
    return Response.json({ error: "冇權刪除呢條留言" }, { status: 403 });
  }

  const { error } = await supabase.from("board_comments").delete().eq("id", cid);
  if (error) {
    console.error("[board] 刪除留言失敗:", error);
    return Response.json({ error: "刪除失敗，請稍後再試" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
