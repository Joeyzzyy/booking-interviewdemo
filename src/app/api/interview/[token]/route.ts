import { getSupabase } from "@/lib/booking/db";
import { getActiveQuestions, getAnswerProgress, getInterviewByToken } from "@/lib/interview/store";

export const dynamic = "force-dynamic";

/** GET /api/interview/[token] — 面試信息 + 題目 + 進度（工人端，免登入） */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return Response.json({ error: "無效連結" }, { status: 404 });
  }
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "服務暫時不可用" }, { status: 503 });

  const interview = await getInterviewByToken(token);
  if (!interview) return Response.json({ error: "連結不存在或已失效" }, { status: 404 });

  const questions = await getActiveQuestions();
  const progress = await getAnswerProgress(interview.id);

  return Response.json(
    {
      workerName: interview.worker_name,
      status: interview.status,
      questions: questions.map((q) => ({ id: q.id, question: q.question })),
      progress,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
