import { getSessionCustomer, isProfileApproved } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";
import { sanitizePostHtml, plainText } from "@/lib/booking/board";

export const dynamic = "force-dynamic";

/**
 * GET /api/board?offset=N — 資訊交流區帖子列表
 * - pinned：全部置頂帖（最多 12 條，新到舊），不參與分頁
 * - posts：非置頂帖分頁（每頁 10 條，新到舊），hasMore 表示是否還有下一頁
 * - canManage：當前用戶係管理員時前端顯示置頂 / 刪除任何帖子嘅操作
 * POST /api/board — 發帖 { title, content }
 * 均需登入且註冊資料審核通過。
 */
const PAGE_SIZE = 10;
const PINNED_CAP = 12;
const POST_SELECT = "id, title, content, created_at, pinned, customer_id, customers(applicant_name, company_name)";

interface PostRow {
  id: string;
  title: string;
  content: string;
  created_at: string;
  pinned: boolean;
  customer_id: string;
  customers: { applicant_name: string | null; company_name: string | null } | null;
}

export async function GET(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer || !isProfileApproved(customer)) {
    return Response.json({ error: "審核通過後先可以用交流區" }, { status: 403 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "服務暫時不可用" }, { status: 503 });
  }

  const rawOffset = Number(new URL(request.url).searchParams.get("offset"));
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  const mapPost = (p: PostRow) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    createdAt: p.created_at,
    own: p.customer_id === customer.id,
    pinned: Boolean(p.pinned),
    authorName: p.customers?.applicant_name || "用戶",
    companyName: p.customers?.company_name || "",
  });

  // 置頂帖：全部返回（封頂 12），唔跟分頁
  const { data: pinnedData, error: pinnedError } = await supabase
    .from("board_posts")
    .select(POST_SELECT)
    .eq("pinned", true)
    .order("created_at", { ascending: false })
    .limit(PINNED_CAP);
  if (pinnedError) {
    console.error("[board] 讀取置頂帖失敗:", pinnedError);
    return Response.json({ error: "讀取失敗" }, { status: 500 });
  }

  // 非置頂帖：多取 1 條判斷 hasMore
  const { data, error } = await supabase
    .from("board_posts")
    .select(POST_SELECT)
    .eq("pinned", false)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE);
  if (error) {
    console.error("[board] 讀取失敗:", error);
    return Response.json({ error: "讀取失敗" }, { status: 500 });
  }

  const rows = (data || []) as unknown as PostRow[];
  const hasMore = rows.length > PAGE_SIZE;
  const posts = rows.slice(0, PAGE_SIZE).map(mapPost);
  const pinned = ((pinnedData || []) as unknown as PostRow[]).map(mapPost);

  // 批量取 like / comment 統計（兩條查詢，避免 N+1；表未建立時靜默降級為 0）
  const ids = [...pinned, ...posts].map((p) => p.id);
  const likeCount = new Map<string, number>();
  const likedByMe = new Set<string>();
  const commentCount = new Map<string, number>();
  if (ids.length > 0) {
    const [likesRes, commentsRes] = await Promise.all([
      supabase.from("board_post_likes").select("post_id, customer_id").in("post_id", ids),
      supabase.from("board_comments").select("post_id").in("post_id", ids),
    ]);
    if (likesRes.error) {
      console.warn("[board] 讚好統計失敗（可能未執行 board.sql 新表）:", likesRes.error.message);
    } else {
      for (const r of likesRes.data || []) {
        likeCount.set(r.post_id, (likeCount.get(r.post_id) || 0) + 1);
        if (r.customer_id === customer.id) likedByMe.add(r.post_id);
      }
    }
    if (commentsRes.error) {
      console.warn("[board] 留言統計失敗（可能未執行 board.sql 新表）:", commentsRes.error.message);
    } else {
      for (const r of commentsRes.data || []) {
        commentCount.set(r.post_id, (commentCount.get(r.post_id) || 0) + 1);
      }
    }
  }
  const enrich = <T extends { id: string }>(p: T) => ({
    ...p,
    likeCount: likeCount.get(p.id) || 0,
    likedByMe: likedByMe.has(p.id),
    commentCount: commentCount.get(p.id) || 0,
  });

  return Response.json({
    posts: posts.map(enrich),
    pinned: pinned.map(enrich),
    hasMore,
    canManage: Boolean(customer.is_admin),
  });
}

export async function POST(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer || !isProfileApproved(customer)) {
    return Response.json({ error: "審核通過後先可以發帖", code: "APPROVAL_REQUIRED" }, { status: 403 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "服務暫時不可用" }, { status: 503 });
  }

  let body: { title?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
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

  const { error } = await supabase.from("board_posts").insert({
    customer_id: customer.id,
    title,
    content,
  });
  if (error) {
    console.error("[board] 發帖失敗:", error);
    return Response.json({ error: "發佈失敗，請稍後再試" }, { status: 500 });
  }
  return Response.json({ ok: true }, { status: 201 });
}
