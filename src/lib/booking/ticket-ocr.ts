/**
 * 機票 OCR：上傳機票 / 行程單相片、PDF → 提取乘客及航班資料。
 * 優先級：MINIMAX_API_KEY（MiniMax 視覺模型）> GEMINI_API_KEY；未配置時調用方需提示手動輸入。
 */

import { isMinimaxEnabled, minimaxVisionJson } from "@/lib/interview/minimax";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** 提取 prompt（MiniMax / Gemini 共用同一段） */
const OCR_PROMPT =
  "呢張係機票或行程單嘅相片/截圖/PDF。請提取：1) 乘客姓名（passengerName，英文全名）；2) 航班號（flightNo，例如 CX906）；3) 抵港日期（arrivalDate，格式 YYYY-MM-DD，以抵達香港 HKG 嘅日期為準）；4) 抵港時間（arrivalTime，格式 HH:mm，24 小時制，例如 15:30）；5) 出發地（departure，機場或城市名）。只輸出 JSON：{\"passengerName\": string|null, \"flightNo\": string|null, \"arrivalDate\": string|null, \"arrivalTime\": string|null, \"departure\": string|null}。某項睇唔清楚或者唔係機票，對應值輸出 null。";

export interface TicketOcrResult {
  passengerName: string | null;
  flightNo: string | null;
  arrivalDate: string | null;
  arrivalTime: string | null;
  departure: string | null;
}

const EMPTY_RESULT: TicketOcrResult = {
  passengerName: null,
  flightNo: null,
  arrivalDate: null,
  arrivalTime: null,
  departure: null,
};

export function isTicketOcrEnabled(): boolean {
  return Boolean(process.env.MINIMAX_API_KEY || process.env.GEMINI_API_KEY);
}

/** 標準化日期為 YYYY-MM-DD（模型可能輸出 DD/MM/YYYY 等格式） */
function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // 已是 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY 或 DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

/** 標準化時間為 HH:mm（24 小時制） */
function normalizeTime(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/\s/g, "");
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(AM|PM)?$/);
  if (!m) return null;
  let hh = Number(m[1]);
  const mm = m[2];
  const ampm = m[3];
  if (ampm) {
    if (hh === 12) hh = ampm === "AM" ? 0 : 12;
    else if (ampm === "PM") hh += 12;
  }
  if (hh > 23 || Number(mm) > 59) return null;
  return `${String(hh).padStart(2, "0")}:${mm}`;
}

/** 解析 OCR JSON → 規範化結果；解析失敗或空值返回 null 字段 */
function parseOcrJson(text: string): TicketOcrResult {
  try {
    const parsed = JSON.parse(text);
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const flightNo = str(parsed.flightNo);
    return {
      passengerName: str(parsed.passengerName),
      flightNo: flightNo ? flightNo.toUpperCase().replace(/\s/g, "") : null,
      arrivalDate: normalizeDate(str(parsed.arrivalDate) || ""),
      arrivalTime: normalizeTime(str(parsed.arrivalTime) || ""),
      departure: str(parsed.departure),
    };
  } catch {
    return { ...EMPTY_RESULT };
  }
}

/** 機票/行程單圖片/PDF（≤4MB）→ 航班資料；識別唔到嘅字段為 null */
export async function parseTicket(
  fileBuffer: Buffer,
  mimeType: string
): Promise<TicketOcrResult> {
  // 路線 A：MiniMax 視覺模型
  if (isMinimaxEnabled()) {
    const raw = await minimaxVisionJson(OCR_PROMPT, fileBuffer, mimeType);
    return parseOcrJson(raw);
  }

  // 路線 B：Gemini
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("機票自動識別未配置（GEMINI_API_KEY），請手動輸入");

  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: mimeType, data: fileBuffer.toString("base64") } },
            { text: OCR_PROMPT },
          ],
        },
      ],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    console.error("[ticket-ocr] Gemini 錯誤:", res.status, await res.text());
    throw new Error("機票識別失敗，請手動輸入");
  }
  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return parseOcrJson(text);
}
