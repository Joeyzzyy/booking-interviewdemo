import { getSessionCustomer, isProfileApproved } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";

export const dynamic = "force-dynamic";

/** POST /api/board/[id]/like — 切換讚好（審核通過用戶），返回 { liked, likeCount } */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = await getSessionCustomer(request);
  if (!customer || !isProfileApproved(customer)) {
    return Response.json({ error: "審核通過後先可以用交流區" }, { status: 403 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "服務暫時不可用" }, { status: 503 });
  }

  const { id } = await params;
  const { data: post } = await supabase
    .from("board_posts")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!post) {
    return Response.json({ error: "帖子不存在" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("board_post_likes")
    .select("post_id")
    .eq("post_id", id)
    .eq("customer_id", customer.id)
    .maybeSingle();

  let liked: boolean;
  if (existing) {
    const { error } = await supabase
      .from("board_post_likes")
      .delete()
      .eq("post_id", id)
      .eq("customer_id", customer.id);
    if (error) {
      console.error("[board] 取消讚好失敗:", error);
      return Response.json({ error: "操作失敗，請稍後再試" }, { status: 500 });
    }
    liked = false;
  } else {
    const { error } = await supabase
      .from("board_post_likes")
      .insert({ post_id: id, customer_id: customer.id });
    if (error) {
      console.error("[board] 讚好失敗:", error);
      return Response.json({ error: "操作失敗，請稍後再試" }, { status: 500 });
    }
    liked = true;
  }

  const { count } = await supabase
    .from("board_post_likes")
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", id);
  return Response.json({ liked, likeCount: count || 0 });
}
