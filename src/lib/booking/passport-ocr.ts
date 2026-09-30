/**
 * 護照 OCR：上傳護照相片 / PDF → 提取工人姓名 + 護照號碼。
 * 與面試模組共用 GEMINI_API_KEY / GEMINI_MODEL；未配置時調用方需提示手動輸入。
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface PassportOcrResult {
  workerName: string;
  passportNo: string;
}

export function isPassportOcrEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** 護照圖片/PDF（≤4MB）→ { workerName, passportNo }；識別唔到時對應值為空字串 */
export async function parsePassport(
  fileBuffer: Buffer,
  mimeType: string
): Promise<PassportOcrResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("護照自動識別未配置（GEMINI_API_KEY），請手動輸入");

  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: mimeType, data: fileBuffer.toString("base64") } },
            {
              text: "呢張係護照嘅相片或掃描件。請提取：1) 持證人英文姓名（Surname + Given names 合併成一個字串，順序同護照一致，例：DELA CRUZ MARIA SANTOS）；2) 護照號碼（Passport / Document No.，只保留字母同數字）。只輸出 JSON：{\"name\": string, \"passportNo\": string}。如果唔係護照、或者某項睇唔清楚，對應值輸出空字串。",
            },
          ],
        },
      ],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    console.error("[passport-ocr] Gemini 錯誤:", res.status, await res.text());
    throw new Error("護照識別失敗，請手動輸入");
  }
  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  try {
    const parsed = JSON.parse(text);
    return {
      workerName: String(parsed.name || "").trim(),
      passportNo: String(parsed.passportNo || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
    };
  } catch {
    return { workerName: "", passportNo: "" };
  }
}
