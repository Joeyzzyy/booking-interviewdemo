import { getSupabase } from "@/lib/booking/db";

export const dynamic = "force-dynamic";

/** GET 題庫列表（含停用） */
export async function GET(request: Request) {
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "數據庫未配置" }, { status: 503 });
  const { data, error } = await supabase
    .from("interview_questions")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return Response.json({ error: "讀取失敗" }, { status: 500 });
  return Response.json({ questions: data || [] });
}

/** POST 新增問題 { question, focus?, sortOrder? } */
export async function POST(request: Request) {
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "數據庫未配置" }, { status: 503 });

  let body: { question?: string; focus?: string; sortOrder?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  if (!body.question?.trim()) {
    return Response.json({ error: "請填寫問題" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("interview_questions")
    .insert({
      question: body.question.trim(),
      focus: body.focus?.trim() || null,
      sort_order: body.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) return Response.json({ error: "新增失敗" }, { status: 500 });
  return Response.json({ question: data }, { status: 201 });
}
