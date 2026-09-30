import { getSessionCustomer } from "@/lib/booking/auth";
import { getSupabase } from "@/lib/booking/db";
import { generateQuestionAssets } from "@/lib/interview/tts";
import { toUserMessage } from "@/lib/interview/ai-errors";

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

  let assets;
  try {
    assets = await generateQuestionAssets(q.id, q.question);
  } catch (e) {
    console.error("[interview] 語音生成失敗:", e);
    // 友善提示 + 詳情（環節/狀態碼/上游原文），方便截圖診斷
    return Response.json({ error: toUserMessage(e) }, { status: 502 });
  }
  return Response.json({ ok: true, ...assets });
}
