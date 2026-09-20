import { getSupabase } from "@/lib/booking/db";

export const MAX_ATTEMPTS = 3; // 每題最多作答次數
export const MAX_VIDEO_SECONDS = 90; // 單題錄製上限（前端強制）
export const MAX_VIDEO_SIZE = 60 * 1024 * 1024; // 60MB 直傳上限
export const VIDEO_ACCEPT = ["video/webm", "video/mp4"];

export interface Interview {
  id: string;
  token: string;
  worker_name: string;
  resume_text: string | null;
  status: "pending" | "in_progress" | "completed";
  report: Record<string, unknown> | null;
  created_at: string;
}

export interface Question {
  id: string;
  question: string;
  focus: string | null;
  sort_order: number;
}

export async function getInterviewByToken(token: string): Promise<Interview | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("interviews")
    .select("id, token, worker_name, resume_text, status, report, created_at")
    .eq("token", token)
    .maybeSingle();
  return (data as Interview) || null;
}

export async function getActiveQuestions(): Promise<Question[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("interview_questions")
    .select("id, question, focus, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as Question[]) || [];
}

/** 該面試每題的作答情況：attempts 次數 + 是否已通過 */
export async function getAnswerProgress(
  interviewId: string
): Promise<Record<string, { attempts: number; passed: boolean }>> {
  const supabase = getSupabase();
  if (!supabase) return {};
  const { data } = await supabase
    .from("interview_answers")
    .select("question_id, passed")
    .eq("interview_id", interviewId);
  const progress: Record<string, { attempts: number; passed: boolean }> = {};
  for (const a of data || []) {
    const qid = a.question_id as string;
    if (!progress[qid]) progress[qid] = { attempts: 0, passed: false };
    progress[qid].attempts += 1;
    if (a.passed) progress[qid].passed = true;
  }
  return progress;
}

/** 當前應答的題目（順序作答）：第一個未通過的題 */
export function currentQuestion(
  questions: Question[],
  progress: Record<string, { attempts: number; passed: boolean }>
): Question | null {
  return questions.find((q) => !progress[q.id]?.passed) || null;
}
