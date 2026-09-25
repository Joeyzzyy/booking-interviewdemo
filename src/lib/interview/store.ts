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
  customer_id: string | null;
  created_at: string;
}

export interface Question {
  id: string;
  question: string;
  focus: string | null;
  sort_order: number;
  /** 各語言譯文：{ en, id, tl, zh } */
  translations?: Record<string, string> | null;
  /** 各語言 TTS 音頻 storage 路徑 */
  audio?: Record<string, string> | null;
}

export async function getInterviewByToken(token: string): Promise<Interview | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("interviews")
    .select("id, token, worker_name, resume_text, status, report, customer_id, created_at")
    .eq("token", token)
    .maybeSingle();
  return (data as Interview) || null;
}

/**
 * 取某位用戶的有效題目；ownerId 為 null 時取「共用示範題庫」（customer_id IS NULL）。
 * 工人端作答時，按該場面試的歸屬人取題。
 */
export async function getActiveQuestionsForOwner(ownerId: string | null): Promise<Question[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let query = supabase
    .from("interview_questions")
    .select("id, question, focus, sort_order, translations, audio")
    .eq("active", true);
  query = ownerId ? query.eq("customer_id", ownerId) : query.is("customer_id", null);
  const { data } = await query
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as Question[]) || [];
}

/** 共用示範題庫（後台未指定歸屬人的題目） */
export async function getActiveQuestions(): Promise<Question[]> {
  return getActiveQuestionsForOwner(null);
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
