/**
 * 客戶端音頻提取（瀏覽器端專用）：
 * MediaRecorder 視頻（Chrome webm / Safari mp4）→ 16kHz mono 16-bit PCM WAV。
 * 各瀏覽器可以解碼自己錄出嘅容器；解碼失敗時拋錯，調用方當「冇音頻」處理（盡力而為）。
 * 用途：MiniMax STT（asr-1.0）唔接受視頻流 / webm 容器，所以要喺客戶端抽純音頻上傳。
 */

const TARGET_RATE = 16000; // STT 友好採樣率；90 秒 ≈ 2.9MB

function writeString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

/** AudioBuffer（mono）→ 44-byte header 嘅 16-bit PCM WAV Blob */
function encodeWav(audio: AudioBuffer): Blob {
  const samples = audio.getChannelData(0);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * 2, true); // byteRate = rate × 1ch × 2bytes
  view.setUint16(32, 2, true); // blockAlign
  view.setUint16(34, 16, true); // bits
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** 錄製成品 Blob → WAV Blob（16kHz mono 16-bit）。失敗拋錯（解碼唔到 / 瀏覽器唔支持） */
export async function blobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = w.AudioContext || w.webkitAudioContext;
  if (!Ctor) throw new Error("瀏覽器唔支持 AudioContext");
  const ctx = new Ctor();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer);
  } finally {
    void ctx.close().catch(() => {});
  }
  // 重採樣到 16kHz mono
  const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
  const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return encodeWav(rendered);
}
