/**
 * 視頻面試 AI 能力。
 *
 * 優先級：
 * - 語音轉寫：STT_API_KEY（OpenAI 兼容平台，默認硅基流動 SenseVoice）> GEMINI_API_KEY（直接吃視頻文件）
 *   （MiniMax STT asr-1.0 唔接受 mp4/webm 容器，所以保留硅基流動 SenseVoice 做視頻轉寫）
 * - 文本分析（逐題判斷 + 整體報告）：MINIMAX_API_KEY > GEMINI_API_KEY
 * 全部未配置時降級（判斷自動通過、報告標註未啟用）。
 */

import {
  classifyHttpError,
  missingKeyError,
  networkError,
  parseError,
} from "./ai-errors";
import { isMinimaxEnabled, minimaxChatJson, minimaxStt } from "./minimax";

const STT_URL = process.env.STT_BASE_URL || "https://api.siliconflow.cn/v1/audio/transcriptions";
const STT_MODEL = process.env.STT_MODEL || "FunAudioLLM/SenseVoiceSmall";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export function isAiEnabled(): boolean {
  const stt = Boolean(process.env.STT_API_KEY || process.env.GEMINI_API_KEY);
  const llm = Boolean(process.env.MINIMAX_API_KEY || process.env.GEMINI_API_KEY);
  return stt && llm;
}

// ---------- Gemini ----------

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

async function geminiGenerate(parts: GeminiPart[], json: boolean): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw missingKeyError("Gemini");
  let res: Response;
  try {
    res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.2,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });
  } catch (e) {
    throw networkError("Gemini", e, GEMINI_MODEL);
  }
  if (!res.ok) throw classifyHttpError("Gemini", res.status, await res.text(), GEMINI_MODEL);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ---------- 語音轉寫 ----------

/** 路線 A 共用：OpenAI 兼容 STT（硅基流動 / Groq / OpenAI）multipart 調用 */
async function siliconflowStt(fileBuffer: Buffer, filename: string, contentType: string): Promise<string> {
  const form = new FormData();
  form.append("model", STT_MODEL);
  form.append("file", new Blob([new Uint8Array(fileBuffer)], { type: contentType }), filename);
  let res: Response;
  try {
    res = await fetch(STT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.STT_API_KEY}` },
      body: form,
    });
  } catch (e) {
    throw networkError("語音轉寫（STT）", e, STT_MODEL);
  }
  if (!res.ok) throw classifyHttpError("語音轉寫（STT）", res.status, await res.text(), STT_MODEL);
  const data = await res.json();
  return (data.text || "").trim();
}

/**
 * 純音頻（客戶端預抽嘅 WAV）→ 文字。
 * MiniMax asr-1.0 優先（粵語效果好，內置 5xx 重試）；失敗且有 STT_API_KEY 時
 * 即場回落硅基流動 SenseVoice（wav 直接可用，唔使行慢速視頻鏈）。
 * 兩個 key 都未配置 → 返回空字串（調用方回落視頻轉寫鏈）。
 */
export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
  if (isMinimaxEnabled()) {
    try {
      return await minimaxStt(audioBuffer, filename);
    } catch (e) {
      if (!process.env.STT_API_KEY) throw e;
      console.error("[stt] MiniMax 轉寫失敗，回落硅基流動：", e);
      try {
        return await siliconflowStt(audioBuffer, filename, "audio/wav");
      } catch (fallbackErr) {
        console.error("[stt] 硅基流動回落都失敗：", fallbackErr);
        throw e; // 透出主 provider（MiniMax）嘅錯誤詳情俾用戶截圖
      }
    }
  }
  if (process.env.STT_API_KEY) {
    return siliconflowStt(audioBuffer, filename, "audio/wav");
  }
  return "";
}

/** 視頻（webm/mp4）→ 文字（舊流程，冇預抽音頻時用）。語言限定中文（普通話/粵語）或英文。 */
export async function transcribeVideo(
  videoBuffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  // 路線 A：OpenAI 兼容 STT（硅基流動 / Groq / OpenAI）
  if (process.env.STT_API_KEY) {
    return siliconflowStt(videoBuffer, filename, contentType);
  }

  // 路線 B：Gemini 直接吃視頻文件（inline base64，≤20MB）
  // 註：MiniMax STT（asr-1.0）唔接受 mp4/webm 容器，所以唔加 MiniMax 路線，保留 Gemini 兜底
  if (process.env.GEMINI_API_KEY) {
    if (videoBuffer.length > 20 * 1024 * 1024) {
      throw new Error("視頻超過 Gemini 內聯上限（20MB），請縮短錄製時間");
    }
    const text = await geminiGenerate(
      [
        {
          inline_data: {
            mime_type: contentType.split(";")[0],
            data: videoBuffer.toString("base64"),
          },
        },
        {
          text: "請將呢段錄音嘅說話內容逐字轉寫出嚟。語言可能係普通話、粵語或英文。只輸出轉寫文字，唔好加任何解釋或格式。",
        },
      ],
      false
    );
    return text.trim();
  }

  console.warn("[interview] 未配置轉寫 key（STT_API_KEY / GEMINI_API_KEY），跳過轉寫");
  return "";
}

// ---------- 文本分析（MiniMax 優先，Gemini 兜底） ----------

async function llmJson(systemPrompt: string, userPrompt: string): Promise<string> {
  if (isMinimaxEnabled()) {
    return minimaxChatJson(systemPrompt, userPrompt);
  }
  if (process.env.GEMINI_API_KEY) {
    return geminiGenerate(
      [{ text: `${systemPrompt}\n\n${userPrompt}\n\n只輸出 JSON。` }],
      true
    );
  }
  throw missingKeyError("MiniMax / Gemini（文本分析）");
}

export interface JudgeResult {
  passed: boolean;
  feedback: string;
}

function hasLlm(): boolean {
  return Boolean(process.env.MINIMAX_API_KEY || process.env.GEMINI_API_KEY);
}

/**
 * 整場轉寫按題切分（全程連續錄製模式）：
 * 工人一次過錄完所有題目，LLM 把整段逐字稿按題目歸屬切分出每題回答。
 * 返回 { questionId → 該題回答文字 }；切分失敗/無轉寫時返回空對象（調用方標「（無轉寫）」）。
 * events（切題時間線，秒）可選附上，幫助 LLM 對應題目順序。
 */
export async function segmentAnswers(
  questions: { id: string; question: string }[],
  transcript: string,
  events: { questionId: string; at: number }[] = []
): Promise<Record<string, string>> {
  if (!hasLlm() || !transcript.trim()) return {};
  const qLines = questions.map((q, i) => `Q${i + 1}（id=${q.id}）：${q.question}`).join("\n");
  const evLines = events
    .map((e) => {
      const idx = questions.findIndex((q) => q.id === e.questionId);
      return idx >= 0 ? `第 ${e.at} 秒切到 Q${idx + 1}` : null;
    })
    .filter(Boolean)
    .join("；");
  const raw = await llmJson(
    "你係面試記錄整理助手。工人用一次過連續錄音回答咗一系列問題（題目順序與編號如下，工人可能跳答、重答或按順序作答）。請把整段逐字稿按題目歸屬切分：每題抽出工人對該題嘅實際回答原文（可適度去掉口頭禪重複字，但唔好改寫意思、唔好補充內容）。某題完全搵唔到對應回答時，該題答案留空字串。只輸出 JSON：{\"answers\": [{\"id\": \"題目 id\", \"answer\": \"該題回答\"}]}。",
    `【題目】\n${qLines}\n\n${evLines ? `【切題時間線】${evLines}\n\n` : ""}【整段逐字稿】\n${transcript}`
  );
  try {
    const parsed = JSON.parse(raw);
    const out: Record<string, string> = {};
    const valid = new Set(questions.map((q) => q.id));
    for (const item of Array.isArray(parsed.answers) ? parsed.answers : []) {
      if (item && valid.has(item.id) && typeof item.answer === "string") {
        out[item.id] = item.answer.trim();
      }
    }
    return out;
  } catch (e) {
    console.error("[interview] 逐題切分解析失敗:", e, raw.slice(0, 200));
    return {};
  }
}

export interface InterviewReport {
  score: number;
  summary: string;
  strengths: string[];
  concerns: string[];
  resumeMatch: string;
  recommendation: string;
  generatedBy: "ai" | "none";
}

/** 整體報告：簡歷 × 全部問答逐字稿 → 評分與匹配分析 */
export async function generateReport(
  workerName: string,
  resumeText: string,
  qaList: { question: string; answer: string }[]
): Promise<InterviewReport> {
  if (!hasLlm()) {
    return {
      score: 0,
      summary: "AI 未配置（MINIMAX_API_KEY / GEMINI_API_KEY），未生成報告。",
      strengths: [],
      concerns: [],
      resumeMatch: "",
      recommendation: "",
      generatedBy: "none",
    };
  }
  const qa = qaList.map((q, i) => `Q${i + 1} ${q.question}\nA：${q.answer}`).join("\n\n");
  const raw = await llmJson(
    "你係外傭中介嘅面試分析師。根據工人簡歷同視頻面試逐字稿，評估工人回答與簡歷嘅匹配性。只輸出 JSON：{\"score\": number(1-10), \"summary\": string(100字內總評), \"strengths\": string[](優點，最多5點), \"concerns\": string[](疑點/前後矛盾/與簡歷不符之處，最多5點), \"resumeMatch\": string(回答與簡歷匹配度分析，150字內), \"recommendation\": string(聘用建議，50字內)}。全部用繁體中文。",
    `工人姓名：${workerName}\n\n【簡歷】\n${resumeText || "（無簡歷文字）"}\n\n【面試問答】\n${qa}`
  );
  try {
    const parsed = JSON.parse(raw);
    return {
      score: Number(parsed.score) || 0,
      summary: String(parsed.summary || ""),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns.map(String) : [],
      resumeMatch: String(parsed.resumeMatch || ""),
      recommendation: String(parsed.recommendation || ""),
      generatedBy: "ai",
    };
  } catch {
    throw parseError("MiniMax / Gemini（報告生成）", raw);
  }
}
