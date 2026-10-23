import { getSupabase } from "@/lib/booking/db";
import {
  ADVANCED_SECTION_KEYS,
  CORE_SECTIONS,
} from "@/lib/interview/shared-questions";
import { BASIC_SECTION_KEYS } from "@/lib/interview/question-banks-v3";

export const MAX_ATTEMPTS = 3; // 每題最多作答次數
export const MAX_EMPLOYERS = 4; // 前僱主迴圈上限（甲方劇本 Q28 規則）
export const MAX_VIDEO_SECONDS = 90; // 單題錄製上限（前端強制）
export const MAX_VIDEO_SIZE = 60 * 1024 * 1024; // 60MB 直傳上限
export const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 照片直傳上限
export const PHOTO_ACCEPT = ["image/jpeg", "image/png"];
export const VIDEO_ACCEPT = ["video/webm", "video/mp4"];

export interface Interview {
  id: string;
  token: string;
  worker_name: string;
  resume_text: string | null;
  status: "pending" | "in_progress" | "processing" | "completed";
  report: Record<string, unknown> | null;
  customer_id: string | null;
  /** 計劃類型：basic=核實 CV（公共題庫 9 章節）；advanced=自製 CV（70 題審查表主體 + 勾選測試章節） */
  plan?: "basic" | "advanced" | null;
  /** advanced 選中的附加測試章節 key 數組（空 = 僅 70 題主體） */
  sections?: string[] | null;
  /** 面試模式：continuous=整段錄製（Basic）；per-question=實時逐題（Advanced v2） */
  mode?: "continuous" | "per-question";
  /** 作品照片 [{kind, label, path}] */
  photos?: { kind: string; label: string; path: string }[] | null;
  created_at: string;
}

export interface Question {
  id: string;
  question: string;
  focus: string | null;
  sort_order: number;
  /** 分類 key（公共題庫 = 表單章節；用戶自定義題目為 null） */
  category?: string | null;
  /** 各語言譯文：{ en, id, tl, zh } */
  translations?: Record<string, string> | null;
  /** 各語言 TTS 音頻 storage 路徑 */
  audio?: Record<string, string> | null;
  /** 評分標準（評分表題目 / DISC 選擇題） */
  rubric?: Record<string, unknown> | null;
}

export async function getInterviewByToken(token: string): Promise<Interview | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("interviews")
    .select("id, token, worker_name, resume_text, status, report, customer_id, plan, sections, mode, photos, created_at")
    .eq("token", token)
    .maybeSingle();
  return (data as Interview) || null;
}

/**
 * 取某位用戶的有效題目：「公共題庫（customer_id IS NULL）+ 自己的題目」。
 * ownerId 為 null 時只取公共題庫。
 * 工人端作答時，按該場面試的歸屬人取題；公共題排前（按 sort_order），自定義題排後。
 */
export async function getActiveQuestionsForOwner(ownerId: string | null): Promise<Question[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let query = supabase
    .from("interview_questions")
    .select("id, question, focus, sort_order, category, translations, audio, rubric")
    .eq("active", true);
  query = ownerId
    ? query.or(`customer_id.is.null,customer_id.eq.${ownerId}`)
    : query.is("customer_id", null);
  const { data } = await query
    .order("customer_id", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as Question[]) || [];
}

/**
 * 按面試計劃取題：
 * - advanced：v2 主體 70 題（adv-* 章節，必出）+ sections 勾選的附加測試章節 + 該用戶自定義題
 * - basic / 無 plan（舊面試）：只出 Basic 題庫 9 章節（不含 adv-* 及測試章節）+ 自定義題
 */
export async function getQuestionsForInterview(interview: Interview): Promise<Question[]> {
  const all = await getActiveQuestionsForOwner(interview.customer_id);
  const advancedKeys = new Set(ADVANCED_SECTION_KEYS);
  if (interview.plan === "advanced") {
    const picked = new Set(
      Array.isArray(interview.sections)
        ? interview.sections.filter((s) => advancedKeys.has(s))
        : []
    );
    const coreKeys = new Set(CORE_SECTIONS.map((s) => s.key));
    // 70 題主體（adv-*）永遠全出 + 僅當勾選時加對應測試章節 + 自定義題（無分類）
    return all.filter(
      (q) => !q.category || coreKeys.has(q.category) || picked.has(q.category)
    );
  }
  // basic：只出新版 Basic 章節（basic-*）+ 自定義題；舊 9 類別行已 active=false
  const basicKeys = new Set(BASIC_SECTION_KEYS);
  return all.filter(
    (q) => !q.category || basicKeys.has(q.category)
  );
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
