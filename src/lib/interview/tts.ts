import { getSupabase } from "@/lib/booking/db";
import { INTERVIEW_BUCKET } from "@/app/api/admin/interviews/route";
import { LOCALES, type LocaleKey } from "./i18n";

/**
 * 題目多語言化：一次生成 4 種語言嘅譯文 + TTS 音頻，存入 Supabase storage。
 * - 翻譯：Gemini（沿用 GEMINI_MODEL）
 * - TTS：Gemini TTS（GEMINI_TTS_MODEL，默認 gemini-2.5-flash-preview-tts）
 * 全部調用「盡力而為」：某語言失敗唔影響其他語言，題目本身照樣可用。
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
// 可選：指向自建代理 / 網關（Gemini 在部分地區不可用；Vercel 部署走 sin1 節點）
const GEMINI_BASE =
  process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/models";

function getKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY 未配置");
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

/** 將題目翻譯為 4 種語言（源語言：中文）。返回 { en, id, tl, zh } */
export async function translateQuestion(question: string): Promise<Partial<Record<LocaleKey, string>>> {
  const key = getKey();
  const res = await fetch(`${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "你係專業翻譯。將下面呢條外傭面試問題翻譯成 5 種語言，保持原意、語氣自然、適合口頭朗讀。\n" +
                "語言代碼：en=English, id=Bahasa Indonesia, tl=Filipino/Tagalog, zh=簡體中文（普通話用詞）。\n" +
                `只輸出 JSON 物件，格式：{"en":"...","id":"...","tl":"...","zh":"..."}\n\n問題：${question}`,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    console.error("[tts] 翻譯失敗:", res.status, (await res.text().catch(() => "")).slice(0, 200));
    return {};
  }
  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  try {
    const parsed = JSON.parse(text);
    const out: Partial<Record<LocaleKey, string>> = {};
    for (const l of LOCALES) {
      const v = parsed[l.key];
      if (typeof v === "string" && v.trim()) out[l.key] = v.trim();
    }
    return out;
  } catch {
    console.error("[tts] 翻譯結果解析失敗:", text.slice(0, 200));
    return {};
  }
}

/** 用 Gemini TTS 合成一段語音，返回 WAV Buffer（不支持的語言返回 null） */
export async function synthesizeSpeech(text: string, lang: LocaleKey): Promise<Buffer | null> {
  const def = LOCALES.find((l) => l.key === lang)!;
  if (!def.ttsCode) return null; // 模型不支持該語言（如粵語）
  const key = getKey();
  const res = await fetch(`${GEMINI_BASE}/${GEMINI_TTS_MODEL}:generateContent?key=${key}`, {
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
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TTS 失敗（${res.status}）: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const inline = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inline?.data) throw new Error("TTS 無音頻返回");
  const raw = Buffer.from(inline.data, "base64");
  const mime: string = inline.mimeType || "";
  if (mime.includes("L16") || mime.includes("pcm")) {
    const rate = Number(mime.match(/rate=(\d+)/)?.[1] || 24000);
    return pcmToWav(raw, rate);
  }
  return raw; // 已是音頻容器格式（wav/mp3）時直接用
}

/**
 * 為題目生成並存儲 5 語言譯文 + TTS 音頻，回寫 interview_questions。
 * 傳入 questionId 需已存在；返回寫入嘅 translations / audio。
 */
export async function generateQuestionAssets(
  questionId: string,
  question: string
): Promise<{ translations: Partial<Record<LocaleKey, string>>; audio: Partial<Record<LocaleKey, string>> }> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("數據庫未配置");

  const translations = await translateQuestion(question);
  // 普通話若翻譯缺失，用原文兜底（題目通常就係中文）
  if (!translations.zh) translations.zh = question;

  const audio: Partial<Record<LocaleKey, string>> = {};
  await Promise.all(
    LOCALES.map(async (l) => {
      const text = translations[l.key];
      if (!text || !l.ttsCode) return;
      try {
        const wav = await synthesizeSpeech(text, l.key);
        if (!wav) return;
        const path = `tts/${questionId}/${l.key}.wav`;
        const { error } = await supabase.storage
          .from(INTERVIEW_BUCKET)
          .upload(path, wav, { contentType: "audio/wav", upsert: true });
        if (error) {
          console.error(`[tts] 音頻上傳失敗（${l.key}）:`, error);
          return;
        }
        audio[l.key] = path;
      } catch (e) {
        console.error(`[tts] 音頻生成失敗（${l.key}）:`, e);
      }
    })
  );

  await supabase
    .from("interview_questions")
    .update({ translations, audio })
    .eq("id", questionId);

  return { translations, audio };
}
