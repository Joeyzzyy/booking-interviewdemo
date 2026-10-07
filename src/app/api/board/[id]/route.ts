import { getSessionCustomer, isProfileApproved } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";
import { sanitizePostHtml, plainText } from "@/lib/booking/board";

export const dynamic = "force-dynamic";

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  customer_id: string;
  customers: { applicant_name: string | null; company_name: string | null } | null;
}

/**
 * GET /api/board/[id] — 帖子詳情（審核通過用戶）
 * 返回：post（同列表欄位）、likeCount / likedByMe / commentCount、comments（舊到新）、canManage
 */
export async function GET(
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
  const { data: post, error } = await supabase
    .from("board_posts")
    .select("id, title, content, created_at, pinned, customer_id, customers(applicant_name, company_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[board] 讀取帖子失敗:", error);
    return Response.json({ error: "讀取失敗" }, { status: 500 });
  }
  if (!post) {
    return Response.json({ error: "帖子不存在" }, { status: 404 });
  }

  const [likesRes, commentsRes] = await Promise.all([
    supabase.from("board_post_likes").select("customer_id").eq("post_id", id),
    supabase
      .from("board_comments")
      .select("id, content, created_at, customer_id, customers(applicant_name, company_name)")
      .eq("post_id", id)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);
  if (likesRes.error || commentsRes.error) {
    console.error("[board] 讀取讚好 / 留言失敗:", likesRes.error || commentsRes.error);
    return Response.json({ error: "讀取失敗" }, { status: 500 });
  }

  const likes = likesRes.data || [];
  const author = post.customers as unknown as { applicant_name: string | null; company_name: string | null } | null;
  const comments = ((commentsRes.data || []) as unknown as CommentRow[]).map((c) => ({
    id: c.id,
    content: c.content,
    createdAt: c.created_at,
    own: c.customer_id === customer.id,
    authorName: c.customers?.applicant_name || "用戶",
    companyName: c.customers?.company_name || "",
  }));

  return Response.json({
    post: {
      id: post.id,
      title: post.title,
      content: post.content,
      createdAt: post.created_at,
      own: post.customer_id === customer.id,
      pinned: Boolean(post.pinned),
      authorName: author?.applicant_name || "用戶",
      companyName: author?.company_name || "",
    },
    likeCount: likes.length,
    likedByMe: likes.some((l) => l.customer_id === customer.id),
    commentCount: comments.length,
    comments,
    canManage: Boolean(customer.is_admin),
  });
}

/** DELETE /api/board/[id] — 刪除帖子（作者本人或管理員） */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = await getSessionCustomer(request);
  if (!customer) {
    return Response.json({ error: "請先登入", code: "LOGIN_REQUIRED" }, { status: 401 });
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

/**
 * PATCH /api/board/[id]
 * - { action: "pin" | "unpin" } — 置頂 / 取消置頂（僅管理員）
 * - { action: "edit", title, content } — 編輯帖子（作者本人或管理員）
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = await getSessionCustomer(request);
  if (!customer) {
    return Response.json({ error: "請先登入", code: "LOGIN_REQUIRED" }, { status: 401 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "服務暫時不可用" }, { status: 503 });
  }

  let body: { action?: string; title?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const { id } = await params;

  /* ---- 置頂 / 取消置頂（僅管理員） ---- */
  if (body.action === "pin" || body.action === "unpin") {
    if (!customer.is_admin) {
      return Response.json({ error: "只有管理員可以置頂帖子" }, { status: 403 });
    }
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

  /* ---- 編輯帖子（作者本人或管理員） ---- */
  if (body.action === "edit") {
    const { data: post } = await supabase
      .from("board_posts")
      .select("customer_id")
      .eq("id", id)
      .maybeSingle();
    if (!post) {
      return Response.json({ error: "帖子不存在" }, { status: 404 });
    }
    if (post.customer_id !== customer.id && !customer.is_admin) {
      return Response.json({ error: "只能編輯自己的帖子" }, { status: 403 });
    }

    const title = (body.title || "").trim();
    const content = sanitizePostHtml(body.content || "");
    if (!title || !plainText(content)) {
      return Response.json({ error: "請填寫標題及內容", code: "TITLE_CONTENT_REQUIRED" }, { status: 400 });
    }
    if (title.length > 80) {
      return Response.json({ error: "標題最長 80 字", code: "TITLE_TOO_LONG" }, { status: 400 });
    }
    if (plainText(content).length > 2000) {
      return Response.json({ error: "內容最長 2000 字", code: "CONTENT_TOO_LONG" }, { status: 400 });
    }

    const { error } = await supabase
      .from("board_posts")
      .update({ title, content })
      .eq("id", id);
    if (error) {
      console.error("[board] 編輯失敗:", error);
      return Response.json({ error: "保存失敗，請稍後再試" }, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "參數錯誤" }, { status: 400 });
}
