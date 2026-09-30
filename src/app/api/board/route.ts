import { getSessionCustomer, isProfileApproved } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";
import sanitizeHtml from "sanitize-html";

/** 帖子內容白名單：只保留排版標籤 + 連結 + 圖片（防 XSS） */
function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "a", "img"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt"],
    },
    allowedSchemes: ["https", "http"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}

/** 去標籤取純文本（長度校驗用） */
function plainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();
}

export const dynamic = "force-dynamic";

/**
 * GET /api/board — 資訊交流區帖子列表（新到舊，最多 100 條）
 * POST /api/board — 發帖 { title, content }
 * 均需登入且註冊資料審核通過。
 */
export async function GET(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer || !isProfileApproved(customer)) {
    return Response.json({ error: "審核通過後先可以用交流區" }, { status: 403 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: "服務暫時不可用" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("board_posts")
    .select("id, title, content, created_at, customer_id, customers(applicant_name, company_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[board] 讀取失敗:", error);
    return Response.json({ error: "讀取失敗" }, { status: 500 });
  }

  const posts = (data || []).map((p) => {
    const author = p.customers as unknown as { applicant_name: string | null; company_name: string | null } | null;
    return {
      id: p.id as string,
      title: p.title as string,
      content: p.content as string,
      createdAt: p.created_at as string,
      own: p.customer_id === customer.id,
      authorName: author?.applicant_name || "用戶",
      companyName: author?.company_name || "",
    };
  });
  return Response.json({ posts });
}

export async function POST(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer || !isProfileApproved(customer)) {
    return Response.json({ error: "審核通過後先可以發帖" }, { status: 403 });
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
    return Response.json({ error: "請填寫標題及內容" }, { status: 400 });
  }
  if (title.length > 80) {
    return Response.json({ error: "標題最長 80 字" }, { status: 400 });
  }
  if (plainText(content).length > 2000) {
    return Response.json({ error: "內容最長 2000 字" }, { status: 400 });
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
