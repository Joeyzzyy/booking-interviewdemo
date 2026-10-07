import { getSessionCustomer, isProfileApproved } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";

export const dynamic = "force-dynamic";

const MAX_COMMENT_LEN = 500;

/** POST /api/board/[id]/comments — 發表留言（純文本，≤500 字，審核通過用戶），返回新留言 */
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

  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  const content = (body.content || "").trim();
  if (!content) {
    return Response.json({ error: "請填寫留言內容" }, { status: 400 });
  }
  if (content.length > MAX_COMMENT_LEN) {
    return Response.json({ error: "留言最長 500 字" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("board_comments")
    .insert({ post_id: id, customer_id: customer.id, content })
    .select("id, created_at")
    .single();
  if (error || !data) {
    console.error("[board] 留言失敗:", error);
    return Response.json({ error: "留言失敗，請稍後再試" }, { status: 500 });
  }

  return Response.json(
    {
      comment: {
        id: data.id,
        content,
        createdAt: data.created_at,
        own: true,
        authorName: customer.applicant_name || "用戶",
        companyName: customer.company_name || "",
      },
    },
    { status: 201 }
  );
}
