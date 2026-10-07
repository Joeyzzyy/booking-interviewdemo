/**
 * MiniMax AI（主要 provider；未配置 MINIMAX_API_KEY 時各調用方回落 Gemini）。
 *
 * 環境變量：
 * - MINIMAX_API_KEY      （必需，設置即啟用 MiniMax 優先路線）
 * - MINIMAX_BASE_URL     （默認 https://api.minimax.io）
 * - MINIMAX_TEXT_MODEL   （默認 MiniMax-M2，文本分析 / 翻譯）
 * - MINIMAX_VISION_MODEL （默認 MiniMax-M3，護照 OCR 等圖像識別）
 * - MINIMAX_TTS_MODEL    （默認 speech-2.8-turbo）
 * - MINIMAX_TTS_VOICE    （默認 English_expressive_narrator）
 *
 * 全部走 plain fetch REST（OpenAI 兼容 chat/completions + t2a_v2），冇 SDK。
 */

import {
  AiServiceError,
  classifyHttpError,
  missingKeyError,
  networkError,
} from "./ai-errors";

const BASE_URL = process.env.MINIMAX_BASE_URL || "https://api.minimax.io";
const TEXT_MODEL = process.env.MINIMAX_TEXT_MODEL || "MiniMax-M2";
const VISION_MODEL = process.env.MINIMAX_VISION_MODEL || "MiniMax-M3";
const TTS_MODEL = process.env.MINIMAX_TTS_MODEL || "speech-2.8-turbo";
const TTS_VOICE = process.env.MINIMAX_TTS_VOICE || "English_expressive_narrator";

export function isMinimaxEnabled(): boolean {
  return Boolean(process.env.MINIMAX_API_KEY);
}

function getKey(): string {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) throw missingKeyError("MiniMax");
  return key;
}

/** 去掉模型輸出嘅 ```json 代碼圍欄同 <think> 思考段，返回純 JSON 文本 */
function stripJsonFence(text: string): string {
  // M2/M3 係推理模型：reasoning_split 失效時 <think> 會混入 content
  const noThink = text.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trim();
  const m = noThink.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : noThink;
}

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "user";
      content: (
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      )[];
    };

/** OpenAI 兼容 chat/completions 共用調用 */
async function minimaxChat(messages: ChatMessage[], model: string, label: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getKey()}`,
        "Content-Type": "application/json",
      },
      // reasoning_split：思考過程獨立返回（M2/M3 推理模型），content 保持乾淨
      body: JSON.stringify({ model, messages, temperature: 0.2, reasoning_split: true }),
    });
  } catch (e) {
    throw networkError(label, e, model);
  }
  if (!res.ok) throw classifyHttpError(label, res.status, await res.text(), model);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * 文本 → JSON 字串（TEXT_MODEL）。
 * MiniMax chat 唔保證支持 response_format json_object，改用 prompt 指令 + 去圍欄。
 * M2/M3 偶爾喺字串值入面放未轉義引號 → JSON.parse 失敗；呢種情況做一次「修復往返」：
 * 將壞 JSON 俾返模型叫佢輸出合法 JSON（仍失敗就原樣返回，由調用方按現有邏輯報錯）。
 */
export async function minimaxChatJson(systemPrompt: string, userPrompt: string): Promise<string> {
  const content = await minimaxChat(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: `${userPrompt}\n\n只輸出 JSON。` },
    ],
    TEXT_MODEL,
    "MiniMax（文本分析）"
  );
  const cleaned = stripJsonFence(content || "{}");
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    console.warn("[minimax] JSON 格式異常，嘗試修復往返…");
  }
  const repaired = await minimaxChat(
    [
      {
        role: "user",
        content: `以下係一段格式錯誤嘅 JSON（常見問題：字串值入面有未轉義嘅雙引號）。請修正為合法 JSON，保持內容唔變，只輸出修正後嘅 JSON，唔好加任何解釋。\n\n${cleaned}`,
      },
    ],
    TEXT_MODEL,
    "MiniMax（JSON 修復）"
  );
  return stripJsonFence(repaired || cleaned);
}

/**
 * 圖片 / 文件 + prompt → JSON 字串（VISION_MODEL）。
 * 注意：MiniMax 唔接受 image_url.detail（會拒絕 detail:"auto"），呢度唔發送。
 */
export async function minimaxVisionJson(
  prompt: string,
  imageBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const content = await minimaxChat(
    [
      {
        role: "user",
        content: [
          { type: "text", text: `${prompt}\n\n只輸出 JSON。` },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBuffer.toString("base64")}` },
          },
        ],
      },
    ],
    VISION_MODEL,
    "MiniMax（圖像識別）"
  );
  return stripJsonFence(content || "{}");
}

/** TTS（t2a_v2，hex 輸出）→ mp3 Buffer；base_resp.status_code !== 0 時拋錯（含 status_msg） */
export async function minimaxTts(text: string, languageBoost: string): Promise<Buffer> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/v1/t2a_v2`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        text,
        stream: false,
        language_boost: languageBoost,
        output_format: "hex",
        voice_setting: { voice_id: TTS_VOICE, speed: 1, vol: 1, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
      }),
    });
  } catch (e) {
    throw networkError("MiniMax TTS", e, TTS_MODEL);
  }
  if (!res.ok) throw classifyHttpError("MiniMax TTS", res.status, await res.text(), TTS_MODEL);
  const data = await res.json();
  const baseResp: { status_code?: number; status_msg?: string } = data.base_resp || {};
  if (baseResp.status_code !== 0 || !data.data?.audio) {
    throw new AiServiceError({
      message: `MiniMax TTS 錯誤：${baseResp.status_msg || "未知錯誤"}`,
      kind: "UPSTREAM",
      provider: "MiniMax TTS",
      model: TTS_MODEL,
      detail: `status_code: ${baseResp.status_code}`,
    });
  }
  return Buffer.from(data.data.audio, "hex"); // mp3
}
