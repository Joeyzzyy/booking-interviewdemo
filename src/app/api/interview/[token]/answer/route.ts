import { getSupabase } from "@/lib/booking/db";
import { INTERVIEW_BUCKET } from "@/app/api/admin/interviews/route";
import { transcribeAudio, transcribeVideo } from "@/lib/interview/ai";
import { getInterviewByToken } from "@/lib/interview/store";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 單題轉寫（≤90 秒音頻）+ 落庫
// Gemini API 封鎖香港區域，函數跑新加坡節點繞開（其他區域無影響）
export const preferredRegion = "sin1";

/**
 * POST /api/interview/[token]/answer — 實時逐題模式（per-question）每題作答提交：
 * body: { questionId, questionText, videoPath, audioPath?, attempt? }
 *
 * 流程：校驗 → 下載該題音頻（無則視頻）→ 轉寫 → upsert interview_answers 一行
 * → 返回 { ok, transcript }，客戶端收到後先顯示下一題。
 * 失敗（如轉寫超時）返回 5xx，客戶端可重試；重答同一題以 attempt 區分覆蓋。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "服務暫時不可用" }, { status: 503 });
  const interview = await getInterviewByToken(token);
  if (!interview) return Response.json({ error: "連結不存在" }, { status: 404 });
  if (interview.status === "completed") {
    return Response.json({ error: "面試已完成" }, { status: 409 });
  }
  if (interview.mode !== "per-question") {
    return Response.json({ error: "此面試模式不支持逐題作答" }, { status: 400 });
  }

  let body: {
    questionId?: string;
    questionText?: string;
    videoPath?: string;
    audioPath?: string;
    attempt?: number;
    /** DISC 選擇題：直接提交選項 key（A/B/C/D），無需錄製 */
    choice?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  const { questionId, questionText, videoPath, audioPath, choice } = body;
  if (!questionId || typeof questionText !== "string" || (!videoPath && !choice)) {
    return Response.json({ error: "缺少參數" }, { status: 400 });
  }
  // 防越權：路徑必須屬於本場面試嘅逐題目錄（選擇題無視頻，跳過校驗）
  if (videoPath && !videoPath.startsWith(`videos/${interview.id}/q/`)) {
    return Response.json({ error: "無效視頻" }, { status: 400 });
  }
  if (audioPath && !audioPath.startsWith(`videos/${interview.id}/q/`)) {
    return Response.json({ error: "無效音頻" }, { status: 400 });
  }
  const attempt = Math.min(Math.max(Math.floor(body.attempt || 1), 1), 4);

  // ---- 轉寫：選擇題直接落庫 choice；其餘音頻優先，失敗回落視頻鏈 ----
  let transcript = choice ? choice.slice(0, 8) : "";
  if (audioPath) {
    const { data: audioData, error: dlErr } = await supabase.storage
      .from(INTERVIEW_BUCKET)
      .download(audioPath);
    if (dlErr || !audioData) {
      console.error("[answer] 音頻下載失敗（回落視頻轉寫）:", dlErr);
    } else {
      try {
        transcript = await transcribeAudio(
          Buffer.from(await audioData.arrayBuffer()),
          audioPath.split("/").pop() || "answer.wav"
        );
      } catch (e) {
        console.error("[answer] 音頻轉寫失敗（回落視頻轉寫）:", e);
      }
    }
  }
  if (!transcript && videoPath) {
    const { data: videoData, error: dlErr } = await supabase.storage
      .from(INTERVIEW_BUCKET)
      .download(videoPath);
    if (dlErr || !videoData) {
      console.error("[answer] 視頻下載失敗:", dlErr);
    } else {
      try {
        transcript = await transcribeVideo(
          Buffer.from(await videoData.arrayBuffer()),
          videoPath.split("/").pop() || "answer.webm",
          videoData.type
        );
      } catch (e) {
        console.error("[answer] 視頻轉寫失敗:", e);
      }
    }
  }

  // ---- 落庫：同題同 attempt 覆蓋（重答），雇主迴圈以 attempt 區分第幾位僱主 ----
  await supabase
    .from("interview_answers")
    .delete()
    .eq("interview_id", interview.id)
    .eq("question_id", questionId)
    .eq("attempt", attempt);
  const { error: insErr } = await supabase.from("interview_answers").insert({
    interview_id: interview.id,
    question_id: questionId,
    question_text: questionText.slice(0, 500),
    attempt,
    video_path: videoPath || null,
    audio_path: audioPath || null,
    transcript,
    passed: true,
    feedback: null,
  });
  if (insErr) {
    console.error("[answer] 作答落庫失敗:", insErr);
    return Response.json({ error: "作答保存失敗，請重試" }, { status: 500 });
  }

  return Response.json({ ok: true, transcript });
}
