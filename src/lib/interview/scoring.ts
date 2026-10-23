/**
 * AI 評分引擎（甲方評分表，2026-10 v3）：
 * - binary 章節（嬰幼兒/小童/寵物/家務烹飪）：按 passKeys/failKeys 逐題 PASS/FAIL → 總分 + 三檔建議
 * - comprehensive：scale 情境題按 bands 評 5/3/1 → M1-M4 模組分（各 /10）；DISC 選擇題計數 → 主導型
 * 失敗唔阻面試：單章失敗標「評分失敗」，其餘章節照樣輸出。
 */

import { getSupabase } from "@/lib/booking/db";
import {
  BINARY_TIERS,
  DISC_PROFILES,
  ASSESSMENT_SECTION_TITLES,
} from "@/lib/interview/question-banks-v3";
import { isMinimaxEnabled, minimaxChatJson } from "@/lib/interview/minimax";

export interface ScoredItem {
  question: string;
  answer: string;
  score: number;
  max: number;
  note: string;
}

export interface SectionAssessment {
  section: string;
  title: string;
  total: number;
  max: number;
  tier?: string;
  tierLabel?: string;
  /** scale 章節嘅模組分（M1-M4） */
  modules?: { key: string; total: number; max: number }[];
  items: ScoredItem[];
}

export interface DiscAssessment {
  section: "disc";
  counts: { D: number; I: number; S: number; C: number };
  dominant: string;
  secondary: string;
  label: string;
  description: string;
  note?: string;
}

export type AssessmentEntry = SectionAssessment | DiscAssessment;

type RubricRow = {
  kind: string;
  max?: number;
  passKeys?: string[];
  failKeys?: string[];
  bands?: Record<string, string>;
  module?: string;
  options?: { key: string; disc: string; text: Record<string, string> }[];
};

/** 調用 LLM 評一整章（binary 或 scale），返回每題 {score, note} */
async function llmScoreSection(
  items: { question: string; promptYue?: string; answer: string; rubric: RubricRow }[]
): Promise<{ score: number; note: string }[]> {
  const lines = items
    .map(
      (it, i) =>
        `Q${i + 1}（題目）：${it.question}\n` +
        (it.promptYue ? `Q${i + 1}（粵語原題）：${it.promptYue}\n` : "") +
        `Q${i + 1}（工人回答）：${it.answer || "（無回答）"}\n` +
        (it.rubric.kind === "binary"
          ? `評分標準：PASS 關鍵（答中其一即 Pass）：${(it.rubric.passKeys || []).join("、")}；FAIL 關鍵（答中即 Fail）：${(it.rubric.failKeys || []).join("、")}；兩者都唔中時按整體常識判斷。`
          : `評分標準：5分＝${it.rubric.bands?.["5"] || ""}；3分＝${it.rubric.bands?.["3"] || ""}；1分＝${it.rubric.bands?.["1"] || ""}。只可以俾 5 / 3 / 1。`)
    )
    .join("\n\n");
  const raw = await minimaxChatJson(
    "你係外傭面試評分員，嚴格按每題評分標準打分，唔好留情。全部用繁體中文。只輸出 JSON：{\"scores\": [{\"score\": number, \"note\": string(一句評語，指出答中/唔中邊啲關鍵)}]}，數組長度同題數一致。",
    `【逐題評分】\n${lines}`
  );
  const parsed = JSON.parse(raw);
  const arr = Array.isArray(parsed.scores) ? parsed.scores : [];
  return items.map((it, i) => {
    const s = arr[i] || {};
    let score = Number(s.score) || 0;
    if (it.rubric.kind === "binary") score = score >= 1 ? 1 : 0;
    else if (it.rubric.kind === "scale") score = score >= 4 ? 5 : score >= 2 ? 3 : 1;
    return { score, note: String(s.note || "").slice(0, 200) };
  });
}

/** Gemini 兜底（MiniMax 未配置時理論上唔會行到——minimaxChatJson 自己會拋錯；此處留接口） */
function hasLlm(): boolean {
  return isMinimaxEnabled() || Boolean(process.env.GEMINI_API_KEY);
}

/**
 * 生成整場面試嘅評分結果（實時逐題模式）。
 * 只處理帶 rubric 嘅題目；冇 rubric 嘅章節直接跳過。
 */
export async function generateAssessments(interviewId: string): Promise<AssessmentEntry[]> {
  const supabase = getSupabase();
  if (!supabase || !hasLlm()) return [];

  const { data: answers } = await supabase
    .from("interview_answers")
    .select("question_id, question_text, transcript")
    .eq("interview_id", interviewId)
    .order("created_at", { ascending: true });
  if (!answers || answers.length === 0) return [];

  const qids = [...new Set(answers.map((a) => a.question_id).filter(Boolean))] as string[];
  const { data: qrows } = await supabase
    .from("interview_questions")
    .select("id, rubric")
    .in("id", qids);
  const rubricMap = new Map(
    (qrows || []).map((q) => [q.id as string, (q.rubric || null) as RubricRow | null])
  );

  interface Row {
    section: string;
    question: string;
    promptYue?: string;
    answer: string;
    rubric: RubricRow;
  }
  const discRows: { answer: string; rubric: RubricRow }[] = [];
  for (const a of answers) {
    const rubric = a.question_id ? rubricMap.get(a.question_id as string) : null;
    if (rubric?.kind === "choice") {
      discRows.push({ answer: String(a.transcript || ""), rubric });
    }
  }

  // 按 category 分組（binary 章節 + comprehensive scale）
  const { data: qrowsWithCat } = await supabase
    .from("interview_questions")
    .select("id, category")
    .in("id", qids);
  const catMap = new Map((qrowsWithCat || []).map((q) => [q.id as string, q.category as string]));

  const byCategory = new Map<string, Row[]>();
  for (const a of answers) {
    const rubric = a.question_id ? rubricMap.get(a.question_id as string) : null;
    if (!rubric || rubric.kind === "choice") continue;
    const cat = a.question_id ? catMap.get(a.question_id as string) || "" : "";
    if (!cat) continue;
    const row: Row = {
      section: cat,
      question: a.question_text,
      promptYue: (rubric as { promptYue?: string }).promptYue,
      answer: String(a.transcript || ""),
      rubric,
    };
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(row);
  }

  const out: AssessmentEntry[] = [];

  // ── binary 章節（infant-care / child-care / pet-care / housework-cooking）──
  for (const [cat, rows] of byCategory) {
    if (rows[0]?.rubric.kind !== "binary") continue;
    const title = ASSESSMENT_SECTION_TITLES[cat]?.zh || cat;
    try {
      const scores = await llmScoreSection(rows);
      const items: ScoredItem[] = rows.map((r, i) => ({
        question: r.question,
        answer: r.answer,
        score: scores[i]?.score ?? 0,
        max: 1,
        note: scores[i]?.note ?? "",
      }));
      const total = items.reduce((s, it) => s + it.score, 0);
      const max = items.length;
      const tierDef = BINARY_TIERS.find((t) => total >= t.min) || BINARY_TIERS[BINARY_TIERS.length - 1];
      out.push({
        section: cat,
        title,
        total,
        max,
        tier: tierDef.tier,
        tierLabel: tierDef.label.zh,
        items,
      });
    } catch (e) {
      console.error(`[assess] ${cat} 評分失敗:`, e);
      out.push({
        section: cat,
        title,
        total: 0,
        max: rows.length,
        tier: "failed",
        tierLabel: "評分失敗",
        items: rows.map((r) => ({ question: r.question, answer: r.answer, score: 0, max: 1, note: "" })),
      });
    }
  }

  // ── comprehensive：scale 情境題（M1-M4）+ DISC ──
  const scaleRows = byCategory.get("comprehensive")?.filter((r) => r.rubric.kind === "scale") || [];
  if (scaleRows.length > 0) {
    try {
      const scores = await llmScoreSection(scaleRows);
      const items: ScoredItem[] = scaleRows.map((r, i) => ({
        question: r.question,
        answer: r.answer,
        score: scores[i]?.score ?? 1,
        max: 5,
        note: scores[i]?.note ?? "",
      }));
      // 模組分：每模組 2 題 × /5 = /10
      const modules = (["M1", "M2", "M3", "M4"] as const).map((m) => {
        const mItems = items.filter((_, i) => scaleRows[i].rubric.module === m);
        return { key: m, total: mItems.reduce((s, it) => s + it.score, 0), max: mItems.length * 5 };
      });
      out.push({
        section: "comprehensive",
        title: ASSESSMENT_SECTION_TITLES.comprehensive.zh,
        total: items.reduce((s, it) => s + it.score, 0),
        max: items.length * 5,
        modules,
        items,
      });
    } catch (e) {
      console.error("[assess] comprehensive 評分失敗:", e);
    }
  }

  // DISC：選擇題計數（唔使 AI）
  if (discRows.length > 0) {
    const counts = { D: 0, I: 0, S: 0, C: 0 };
    let unanswered = 0;
    for (const d of discRows) {
      const opt = (d.rubric.options || []).find((o) => o.key === d.answer.trim().toUpperCase());
      if (opt && counts[opt.disc as keyof typeof counts] !== undefined) counts[opt.disc as "D" | "I" | "S" | "C"] += 1;
      else unanswered += 1;
    }
    const sorted = (Object.entries(counts) as [string, number][]).sort((a, b) => b[1] - a[1]);
    const dominant = sorted[0]?.[0] || "S";
    const secondary = sorted[1]?.[0] || "";
    const profile = DISC_PROFILES[dominant] || DISC_PROFILES.S;
    out.push({
      section: "disc",
      counts,
      dominant,
      secondary,
      label: profile.label,
      description: profile.description,
      note: unanswered > 0 ? `${unanswered} 題未作答` : undefined,
    });
  }

  return out;
}
