import { getSessionCustomer } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";
import { INTERVIEW_BUCKET } from "@/app/api/admin/interviews/route";
import { generateQuestionAssets } from "@/lib/interview/tts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
// Gemini API 封鎖香港區域（其他區域無影響）
export const preferredRegion = "sin1";

/** GET 當前用戶的題庫列表（含停用） */
export async function GET(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) return Response.json({ error: "請先登入" }, { status: 401 });
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "數據庫未配置" }, { status: 503 });

  const { data, error } = await supabase
    .from("interview_questions")
    .select("*")
    .eq("customer_id", customer.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return Response.json({ error: "讀取失敗" }, { status: 500 });

  // 附上各語言音頻簽名 URL 供試聽（1 小時）
  const rows = data || [];
  const paths = rows.flatMap((r) => Object.values((r.audio as Record<string, string>) || {})).filter(Boolean);
  const urlMap = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(INTERVIEW_BUCKET).createSignedUrls(paths, 3600);
    for (const s of signed || []) if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl);
  }
  return Response.json({
    questions: rows.map((r) => {
      const audioUrls: Record<string, string> = {};
      for (const [lang, p] of Object.entries((r.audio as Record<string, string>) || {})) {
        const u = urlMap.get(p);
        if (u) audioUrls[lang] = u;
      }
      return { ...r, audioUrls };
    }),
  });
}

/** POST 新增問題 { question, focus?, sortOrder? }（歸屬當前用戶） */
export async function POST(request: Request) {
  const customer = await getSessionCustomer(request);
  if (!customer) return Response.json({ error: "請先登入" }, { status: 401 });
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
      customer_id: customer.id,
    })
    .select()
    .single();
  if (error) return Response.json({ error: "新增失敗" }, { status: 500 });

  // 生成 5 語言譯文 + TTS 音頻（失敗唔影響題目使用）
  try {
    await generateQuestionAssets(data.id, data.question);
  } catch (e) {
    console.error("[questions] 翻譯/語音生成失敗（不影響新增）:", e);
  }
  const { data: full } = await supabase
    .from("interview_questions")
    .select("*")
    .eq("id", data.id)
    .single();
  return Response.json({ question: full || data }, { status: 201 });
}
