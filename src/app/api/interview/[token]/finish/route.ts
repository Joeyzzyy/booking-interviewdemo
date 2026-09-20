import { getSupabase } from "@/lib/booking/db";
import { generateReport } from "@/lib/interview/ai";
import {
  currentQuestion,
  getActiveQuestions,
  getAnswerProgress,
  getInterviewByToken,
} from "@/lib/interview/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "sin1"; // 同 answer：繞開 Gemini 香港區域封鎖

/**
 * POST /api/interview/[token]/finish
 * 全部題目通過後調用：生成整體報告（簡歷 × 問答匹配分析），標記面試完成。
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "服務暫時不可用" }, { status: 503 });
  const interview = await getInterviewByToken(token);
  if (!interview) return Response.json({ error: "連結不存在" }, { status: 404 });
  if (interview.status === "completed") {
    return Response.json({ ok: true }); // 冪等
  }

  const questions = await getActiveQuestions();
  const progress = await getAnswerProgress(interview.id);
  if (currentQuestion(questions, progress) !== null) {
    return Response.json({ error: "仲有問題未完成" }, { status: 409 });
  }

  // 取每題最後一次通過的作答
  const { data: answers } = await supabase
    .from("interview_answers")
    .select("question_id, question_text, transcript, passed, created_at")
    .eq("interview_id", interview.id)
    .order("created_at", { ascending: true });

  const qaList = questions.map((q) => {
    const passed = (answers || []).filter((a) => a.question_id === q.id && a.passed);
    const last = passed[passed.length - 1];
    return { question: q.question, answer: last?.transcript || "（無轉寫）" };
  });

  let report;
  try {
    report = await generateReport(interview.worker_name, interview.resume_text || "", qaList);
  } catch (e) {
    console.error("[interview] 報告生成失敗:", e);
    return Response.json({ error: "報告生成失敗，請稍後再試" }, { status: 502 });
  }

  await supabase
    .from("interviews")
    .update({ status: "completed", report, completed_at: new Date().toISOString() })
    .eq("id", interview.id);

  return Response.json({ ok: true });
}
