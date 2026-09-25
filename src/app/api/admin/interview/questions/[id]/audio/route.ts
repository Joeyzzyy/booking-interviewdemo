import { getSupabase } from "@/lib/booking/db";
import { generateQuestionAssets } from "@/lib/interview/tts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "sin1";

/** POST /api/admin/interview/questions/[id]/audio — 重新生成譯文 + TTS 音頻 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "數據庫未配置" }, { status: 503 });

  const { id } = await params;
  const { data: q } = await supabase
    .from("interview_questions")
    .select("id, question")
    .eq("id", id)
    .maybeSingle();
  if (!q) return Response.json({ error: "題目不存在" }, { status: 404 });

  const assets = await generateQuestionAssets(q.id, q.question);
  return Response.json({ ok: true, ...assets });
}
