import { getSupabase } from "@/lib/booking/db";
import { INTERVIEW_BUCKET } from "@/app/api/admin/interviews/route";
import { judgeAnswer, transcribeVideo } from "@/lib/interview/ai";
import {
  currentQuestion,
  getActiveQuestions,
  getAnswerProgress,
  getInterviewByToken,
  MAX_ATTEMPTS,
} from "@/lib/interview/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 下載視頻 + 轉寫 + 判斷，90 秒視頻綽綽有餘
// Gemini API 封鎖香港區域，函數跑新加坡節點繞開（其他區域無影響）
export const preferredRegion = "sin1";

/**
 * POST /api/interview/[token]/answer
 * body: { questionId, videoPath }
 * 下載視頻 → Groq 轉寫 → DeepSeek 判斷 → 記錄作答 → 返回是否通過。
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

  let body: { questionId?: string; videoPath?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  const { questionId, videoPath } = body;
  if (!questionId || !videoPath) {
    return Response.json({ error: "缺少參數" }, { status: 400 });
  }
  // 防越權：路徑必須屬於本場面試
  if (!videoPath.startsWith(`videos/${interview.id}/`)) {
    return Response.json({ error: "無效視頻" }, { status: 400 });
  }

  const questions = await getActiveQuestions();
  const progress = await getAnswerProgress(interview.id);
  const current = currentQuestion(questions, progress);
  if (!current || current.id !== questionId) {
    return Response.json({ error: "請按順序作答" }, { status: 409 });
  }
  const attempt = (progress[current.id]?.attempts || 0) + 1;
  if (attempt > MAX_ATTEMPTS) {
    return Response.json({ error: "呢條問題已達重試上限" }, { status: 409 });
  }

  // 下載視頻 → 轉寫
  const { data: videoData, error: dlErr } = await supabase.storage
    .from(INTERVIEW_BUCKET)
    .download(videoPath);
  if (dlErr || !videoData) {
    console.error("[interview] 視頻下載失敗:", dlErr);
    return Response.json({ error: "視頻讀取失敗，請重新上傳" }, { status: 500 });
  }
  const videoBuffer = Buffer.from(await videoData.arrayBuffer());

  let transcript = "";
  try {
    transcript = await transcribeVideo(videoBuffer, videoPath.split("/").pop() || "answer.webm", videoData.type);
  } catch (e) {
    console.error("[interview] 轉寫失敗:", e);
    return Response.json({ error: "語音識別失敗，請重新錄製（留意環境噪音）" }, { status: 502 });
  }

  // AI 判斷
  let judged;
  try {
    judged = await judgeAnswer(current.question, current.focus, transcript);
  } catch (e) {
    console.error("[interview] AI 判斷失敗:", e);
    return Response.json({ error: "AI 分析失敗，請稍後再試" }, { status: 502 });
  }

  // 記錄作答 + 標記面試進行中
  await supabase.from("interview_answers").insert({
    interview_id: interview.id,
    question_id: current.id,
    question_text: current.question,
    attempt,
    video_path: videoPath,
    transcript,
    passed: judged.passed,
    feedback: judged.feedback,
  });
  if (interview.status === "pending") {
    await supabase.from("interviews").update({ status: "in_progress" }).eq("id", interview.id);
  }

  return Response.json({
    passed: judged.passed,
    feedback: judged.feedback,
    attempt,
    attemptsLeft: MAX_ATTEMPTS - attempt,
  });
}
