import { getSupabase } from "@/lib/booking/db";
import { INTERVIEW_BUCKET } from "@/app/api/admin/interviews/route";
import { LOCALES, type LocaleKey } from "./i18n";
import {
  classifyHttpError,
  missingKeyError,
  networkError,
  parseError,
  toUserMessage,
} from "./ai-errors";
import { isMinimaxEnabled, minimaxChatJson, minimaxTts } from "./minimax";

/**
 * 題目多語言化：一次生成 5 種語言嘅譯文 + TTS 音頻，存入 Supabase storage。
 * - 翻譯：MiniMax（MINIMAX_API_KEY）優先 > Gemini（沿用 GEMINI_MODEL）
 * - TTS：MiniMax TTS（mp3，支持全部 5 種語言）優先 > Gemini TTS（wav；粵語 yue-HK 需要 3.x，2.5 preview 唔支持）
 * 全部調用「盡力而為」：某語言失敗唔影響其他語言，題目本身照樣可用。
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
// 可選：指向自建代理 / 網關（Gemini 在部分地區不可用；Vercel 部署走 sin1 節點）
const GEMINI_BASE =
  process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/models";

function getKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw missingKeyError("Gemini");
  return key;
}

/** PCM16（Gemini TTS 默認輸出）→ WAV 容器，方便瀏覽器播放 */
function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bits = 16): Buffer {
  const blockAlign = channels * (bits / 8);
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** 5 語言翻譯 prompt（MiniMax / Gemini 共用同一段） */
function translatePrompt(question: string): string {
  return (
    "你係專業翻譯。將下面呢條外傭面試問題翻譯成 5 種語言，保持原意、語氣自然、適合口頭朗讀。\n" +
    "語言代碼：en=English, id=Bahasa Indonesia, tl=Filipino/Tagalog, zh=簡體中文（普通話用詞）, yue=繁體中文（香港粵語口語用詞，例如：嘅/喺/咗）。\n" +
    `只輸出 JSON 物件，格式：{"en":"...","id":"...","tl":"...","zh":"...","yue":"..."}\n\n問題：${question}`
  );
}

/** 解析翻譯 JSON → { en, id, tl, zh, yue }（過濾空值） */
function parseTranslations(text: string, providerLabel: string): Partial<Record<LocaleKey, string>> {
  try {
    const parsed = JSON.parse(text);
    const out: Partial<Record<LocaleKey, string>> = {};
    for (const l of LOCALES) {
      const v = parsed[l.key];
      if (typeof v === "string" && v.trim()) out[l.key] = v.trim();
    }
    return out;
  } catch {
    throw parseError(providerLabel, text);
  }
}

/** 將題目翻譯為 5 種語言（源語言：中文）。返回 { en, id, tl, zh, yue }。失敗拋 AiServiceError（由調用方決定如何提示） */
export async function translateQuestion(question: string): Promise<Partial<Record<LocaleKey, string>>> {
  // 路線 A：MiniMax 文本模型
  if (isMinimaxEnabled()) {
    const raw = await minimaxChatJson("你係專業翻譯。", translatePrompt(question));
    return parseTranslations(raw, "MiniMax（題目翻譯）");
  }

  // 路線 B：Gemini
  const key = getKey();
  let res: Response;
  try {
    res = await fetch(`${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: translatePrompt(question) }],
          },
        ],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    });
  } catch (e) {
    throw networkError("Gemini（題目翻譯）", e, GEMINI_MODEL);
  }
  if (!res.ok) throw classifyHttpError("Gemini（題目翻譯）", res.status, await res.text(), GEMINI_MODEL);
  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return parseTranslations(text, "Gemini（題目翻譯）");
}

/** MiniMax TTS language_boost 對應（5 種語言全部支持，粵語行 Chinese,Yue） */
const MINIMAX_BOOST: Record<LocaleKey, string> = {
  en: "English",
  id: "Indonesian",
  tl: "Filipino",
  zh: "Chinese",
  yue: "Chinese,Yue",
};

export interface SpeechResult {
  buffer: Buffer;
  ext: string;
  contentType: string;
}

/**
 * 合成一段語音（不支持的語言返回 null）。
 * MiniMax 優先（mp3）；Gemini 兜底（PCM → WAV）。
 */
export async function synthesizeSpeech(text: string, lang: LocaleKey): Promise<SpeechResult | null> {
  // 路線 A：MiniMax TTS（mp3）
  if (isMinimaxEnabled()) {
    const buffer = await minimaxTts(text, MINIMAX_BOOST[lang]);
    return { buffer, ext: "mp3", contentType: "audio/mpeg" };
  }

  // 路線 B：Gemini TTS（wav）
  const def = LOCALES.find((l) => l.key === lang)!;
  if (!def.ttsCode) return null; // 模型不支持該語言（如粵語）
  const key = getKey();
  let res: Response;
  try {
    res = await fetch(`${GEMINI_BASE}/${GEMINI_TTS_MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            languageCode: def.ttsCode,
            voiceConfig: { prebuiltVoiceConfig: { voiceName: def.voice } },
          },
        },
      }),
    });
  } catch (e) {
    throw networkError("Gemini TTS", e, GEMINI_TTS_MODEL);
  }
  if (!res.ok) throw classifyHttpError("Gemini TTS", res.status, await res.text(), GEMINI_TTS_MODEL);
  const data = await res.json();
  const inline = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inline?.data) throw parseError("Gemini TTS", JSON.stringify(data).slice(0, 300), GEMINI_TTS_MODEL);
  const raw = Buffer.from(inline.data, "base64");
  const mime: string = inline.mimeType || "";
  const buffer =
    mime.includes("L16") || mime.includes("pcm")
      ? pcmToWav(raw, Number(mime.match(/rate=(\d+)/)?.[1] || 24000))
      : raw; // 已是音頻容器格式（wav/mp3）時直接用
  return { buffer, ext: "wav", contentType: "audio/wav" };
}

/**
 * 為題目生成並存儲 5 語言譯文 + TTS 音頻，回寫 interview_questions。
 * 傳入 questionId 需已存在；返回寫入嘅 translations / audio。
 */
export async function generateQuestionAssets(
  questionId: string,
  question: string
): Promise<{
  translations: Partial<Record<LocaleKey, string>>;
  audio: Partial<Record<LocaleKey, string>>;
  /** 每種語言失敗的友善提示（含詳情），供前端展示 */
  warnings: string[];
}> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("數據庫未配置");

  const translations = await translateQuestion(question);
  // 普通話若翻譯缺失，用原文兜底（題目通常就係中文）
  if (!translations.zh) translations.zh = question;

  const audio: Partial<Record<LocaleKey, string>> = {};
  const warnings: string[] = [];
  await Promise.all(
    LOCALES.map(async (l) => {
      const text = translations[l.key];
      if (!text) return;
      try {
        const speech = await synthesizeSpeech(text, l.key);
        if (!speech) return;
        const path = `tts/${questionId}/${l.key}.${speech.ext}`;
        const { error } = await supabase.storage
          .from(INTERVIEW_BUCKET)
          .upload(path, speech.buffer, { contentType: speech.contentType, upsert: true });
        if (error) {
          console.error(`[tts] 音頻上傳失敗（${l.key}）:`, error);
          warnings.push(`【${l.key}】音頻上傳存儲失敗：${error.message}（題目仍可用，可稍後重新生成）`);
          return;
        }
        audio[l.key] = path;
      } catch (e) {
        console.error(`[tts] 音頻生成失敗（${l.key}）:`, e);
        warnings.push(`【${l.key}】${toUserMessage(e)}`);
      }
    })
  );

  await supabase
    .from("interview_questions")
    .update({ translations, audio })
    .eq("id", questionId);

  return { translations, audio, warnings };
}
