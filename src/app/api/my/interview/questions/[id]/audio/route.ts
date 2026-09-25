import { getSessionCustomer } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";
import { generateQuestionAssets } from "@/lib/interview/tts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "sin1";

/**
 * POST /api/my/interview/questions/[id]/audio
 * 重新生成該題目的 5 語言譯文 + TTS 音頻（用於補生成舊題目或文字更新後重生成）。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const customer = await getSessionCustomer(request);
  if (!customer) return Response.json({ error: "請先登入" }, { status: 401 });
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "數據庫未配置" }, { status: 503 });

  const { id } = await params;
  const { data: q } = await supabase
    .from("interview_questions")
    .select("id, question")
    .eq("id", id)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (!q) return Response.json({ error: "題目不存在" }, { status: 404 });

  const assets = await generateQuestionAssets(q.id, q.question);
  return Response.json({ ok: true, ...assets });
}
