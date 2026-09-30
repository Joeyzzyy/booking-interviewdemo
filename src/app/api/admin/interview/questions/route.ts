import { getSupabase } from "@/lib/booking/db";
import { generateQuestionAssets } from "@/lib/interview/tts";
import { toUserMessage } from "@/lib/interview/ai-errors";
import { adminUnauthorized, isAdminRequest } from "@/lib/booking/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "sin1";

/** GET 題庫列表（含停用） */
export async function GET(request: Request) {
  if (!isAdminRequest(request)) return adminUnauthorized();
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "數據庫未配置" }, { status: 503 });
  const { data, error } = await supabase
    .from("interview_questions")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return Response.json({ error: "讀取失敗" }, { status: 500 });

  // 附上各語言音頻簽名 URL 供試聽（1 小時）
  const rows = data || [];
  const paths = rows.flatMap((r) => Object.values((r.audio as Record<string, string>) || {})).filter(Boolean);
  const urlMap = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from("interview-videos").createSignedUrls(paths, 3600);
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

/** POST 新增問題 { question, focus?, sortOrder? } */
export async function POST(request: Request) {
  if (!isAdminRequest(request)) return adminUnauthorized();
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

  // 生成 5 語言譯文 + TTS 音頻（失敗唔影響題目使用，但 warning 要透出俾用戶）
  let warning: string | undefined;
  try {
    const assets = await generateQuestionAssets(data.id, data.question);
    if (assets.warnings.length) warning = assets.warnings.join("\n\n");
  } catch (e) {
    console.error("[questions] 翻譯/語音生成失敗（不影響新增）:", e);
    warning = toUserMessage(e);
  }
  return Response.json({ question: data, ...(warning ? { warning } : {}) }, { status: 201 });
}
