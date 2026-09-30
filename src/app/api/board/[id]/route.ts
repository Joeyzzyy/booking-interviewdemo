import { getSessionCustomer } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";

export const dynamic = "force-dynamic";

/** DELETE /api/board/[id] — 刪除自己的帖子（僅作者本人） */
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
  if (post.customer_id !== customer.id) {
    return Response.json({ error: "只能刪除自己的帖子" }, { status: 403 });
  }

  const { error } = await supabase.from("board_posts").delete().eq("id", id);
  if (error) {
    console.error("[board] 刪除失敗:", error);
    return Response.json({ error: "刪除失敗，請稍後再試" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
