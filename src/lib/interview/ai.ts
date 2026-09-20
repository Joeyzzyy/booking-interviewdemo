/**
 * 視頻面試 AI 能力。
 *
 * 優先級：
 * - 語音轉寫：STT_API_KEY（OpenAI 兼容平台，默認硅基流動 SenseVoice）> GEMINI_API_KEY（直接吃視頻文件）
 * - 文本分析（逐題判斷 + 整體報告）：DEEPSEEK_API_KEY > GEMINI_API_KEY
 * 即：一個 GEMINI_API_KEY 可全包；全部未配置時降級（判斷自動通過、報告標註未啟用）。
 */

const STT_URL = process.env.STT_BASE_URL || "https://api.siliconflow.cn/v1/audio/transcriptions";
const STT_MODEL = process.env.STT_MODEL || "FunAudioLLM/SenseVoiceSmall";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export function isAiEnabled(): boolean {
  const stt = Boolean(process.env.STT_API_KEY || process.env.GEMINI_API_KEY);
  const llm = Boolean(process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY);
  return stt && llm;
}

// ---------- Gemini ----------

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

async function geminiGenerate(parts: GeminiPart[], json: boolean): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY 未配置");
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini 調用失敗（${res.status}）: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ---------- 語音轉寫 ----------

/** 視頻（webm/mp4）→ 文字。語言限定中文（普通話/粵語）或英文。 */
export async function transcribeVideo(
  videoBuffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  // 路線 A：OpenAI 兼容 STT（硅基流動 / Groq / OpenAI）
  if (process.env.STT_API_KEY) {
    const form = new FormData();
    form.append("model", STT_MODEL);
    form.append("file", new Blob([new Uint8Array(videoBuffer)], { type: contentType }), filename);
    const res = await fetch(STT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.STT_API_KEY}` },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`轉寫失敗（${res.status}）: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    return (data.text || "").trim();
  }

  // 路線 B：Gemini 直接吃視頻文件（inline base64，≤20MB）
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

// ---------- 文本分析（DeepSeek 優先，Gemini 兜底） ----------

async function llmJson(systemPrompt: string, userPrompt: string): Promise<string> {
  if (process.env.DEEPSEEK_API_KEY) {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DeepSeek 調用失敗（${res.status}）: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "{}";
  }
  if (process.env.GEMINI_API_KEY) {
    return geminiGenerate(
      [{ text: `${systemPrompt}\n\n${userPrompt}\n\n只輸出 JSON。` }],
      true
    );
  }
  throw new Error("未配置文本分析 key（DEEPSEEK_API_KEY / GEMINI_API_KEY）");
}

export interface JudgeResult {
  passed: boolean;
  feedback: string;
}

function hasLlm(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY);
}

/** 逐題判斷：工人回答是否有效回應了問題（及考察要點） */
export async function judgeAnswer(
  question: string,
  focus: string | null,
  transcript: string
): Promise<JudgeResult> {
  if (!hasLlm()) {
    return { passed: true, feedback: "（AI 未配置，自動通過）" };
  }
  if (!transcript) {
    return { passed: false, feedback: "聽唔到回答內容，請靠近咪高峰大聲少少再答一次。" };
  }
  const raw = await llmJson(
    "你係外傭面試官助手。判斷工人嘅口頭回答是否有效回應咗問題。有效標準：內容與問題相關、有具體實質內容（唔係得一句「知道」「可以」等敷衍）。回答語言可能係普通話、粵語或英文。只輸出 JSON：{\"passed\": boolean, \"feedback\": string}，feedback 用繁體中文，不通過時簡短話畀工人知要補充咩（30 字內），通過時留空字串。",
    `問題：${question}\n${focus ? `考察要點：${focus}\n` : ""}工人回答轉寫：${transcript}`
  );
  try {
    const parsed = JSON.parse(raw);
    return { passed: Boolean(parsed.passed), feedback: String(parsed.feedback || "") };
  } catch {
    return { passed: false, feedback: "系統分析失敗，請再答一次。" };
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
      summary: "AI 未配置（DEEPSEEK_API_KEY / GEMINI_API_KEY），未生成報告。",
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
    throw new Error("報告解析失敗");
  }
}
