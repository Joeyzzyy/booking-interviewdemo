import { getSupabase } from "@/lib/booking/db";
import { INTERVIEW_BUCKET } from "@/app/api/admin/interviews/route";
import { transcribeVideo } from "@/lib/interview/ai";
import {
  currentQuestion,
  getActiveQuestionsForOwner,
  getAnswerProgress,
  getInterviewByToken,
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

  const questions = await getActiveQuestionsForOwner(interview.customer_id);
  const progress = await getAnswerProgress(interview.id);
  const current = currentQuestion(questions, progress);
  if (!current || current.id !== questionId) {
    return Response.json({ error: "請按順序作答" }, { status: 409 });
  }
  const attempt = (progress[current.id]?.attempts || 0) + 1;

  // 下載視頻 → 轉寫
  const { data: videoData, error: dlErr } = await supabase.storage
    .from(INTERVIEW_BUCKET)
    .download(videoPath);
  if (dlErr || !videoData) {
    console.error("[interview] 視頻下載失敗:", dlErr);
    return Response.json({ error: "視頻讀取失敗，請重新上傳" }, { status: 500 });
  }
  const videoBuffer = Buffer.from(await videoData.arrayBuffer());

  // 轉寫（失敗唔阻流程：報告會標註無轉寫）
  let transcript = "";
  try {
    transcript = await transcribeVideo(videoBuffer, videoPath.split("/").pop() || "answer.webm", videoData.type);
  } catch (e) {
    console.error("[interview] 轉寫失敗（仍接受作答）:", e);
  }

  // 提交即通過：工人提交作答即接受（佢可自願重錄後再提交），唔做逐題 AI 門禁。
  // 整體評估喺提交面試時同簡歷一併做（generateReport）。
  await supabase.from("interview_answers").insert({
    interview_id: interview.id,
    question_id: current.id,
    question_text: current.question,
    attempt,
    video_path: videoPath,
    transcript,
    passed: true,
    feedback: null,
  });
  if (interview.status === "pending") {
    await supabase.from("interviews").update({ status: "in_progress" }).eq("id", interview.id);
  }

  return Response.json({ passed: true, feedback: "", attempt });
}
