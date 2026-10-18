/**
 * 服務端 WAV 切段（整場錄製模式）：
 * 整場 16kHz mono 16-bit PCM WAV Buffer → 按時間線切出每題音頻段。
 * 純 Buffer 操作（無 ffmpeg 依賴）：PCM 每秒 = 16000 × 2 bytes，切片即字節區間拷貝。
 */

const HEADER_SIZE = 44; // blobToWav 寫死嘅標準 44-byte 頭

export interface SegmentRange {
  questionId: string;
  startSec: number;
  endSec: number;
}

/** 校驗係我哋客户端 encodeWav 產出嘅 16kHz mono 16-bit PCM WAV */
export function isPcmWav(buf: Buffer): boolean {
  if (buf.length < HEADER_SIZE) return false;
  if (buf.toString("ascii", 0, 4) !== "RIFF") return false;
  if (buf.toString("ascii", 8, 12) !== "WAVE") return false;
  const fmt = buf.toString("ascii", 12, 16);
  if (fmt !== "fmt ") return false; // 冇 fmt chunk 聽埋後面非標準塊，唔支持
  const audioFormat = buf.readUInt16LE(20);
  const channels = buf.readUInt16LE(22);
  const bits = buf.readUInt16LE(34);
  return audioFormat === 1 && channels === 1 && bits === 16;
}

export function wavSampleRate(buf: Buffer): number {
  return buf.readUInt32LE(24);
}

/** 秒 → 字節偏移（16-bit mono） */
function secToOffset(sec: number, rate: number): number {
  return Math.round(sec * rate) * 2;
}

/** 切出 [startSec, endSec) 嘅音頻段，返回獨立可播放嘅 WAV Buffer */
export function sliceWavSegment(
  fullWav: Buffer,
  startSec: number,
  endSec: number
): Buffer {
  const rate = wavSampleRate(fullWav);
  const dataStart = HEADER_SIZE;
  const dataEnd = fullWav.length;
  const from = Math.min(dataStart + Math.max(0, secToOffset(startSec, rate)), dataEnd);
  const to = Math.min(dataStart + Math.max(0, secToOffset(endSec, rate)), dataEnd);
  const pcm = fullWav.subarray(from, Math.max(from, to));
  // 獨立 WAV：44-byte 頭 + 切出嘅 PCM
  const out = Buffer.alloc(HEADER_SIZE + pcm.length);
  fullWav.copy(out, 0, 0, HEADER_SIZE); // 頭直接複用（fmt 參數一樣）
  out.writeUInt32LE(36 + pcm.length, 4); // RIFF chunk size
  out.writeUInt32LE(pcm.length, 40); // data chunk size
  pcm.copy(out, HEADER_SIZE);
  return out;
}

/**
 * 按時間線切出每題音頻段。
 * timeline: 客戶端記錄嘅切題事件（questionId + 該題畫面停留起止秒），
 * 返回 map：questionId → { buffer, startSec, endSec }。
 * 相鄰區間自動去重合併（工人翻返上一題再翻轉頭，同題取最新一次停留區間；
 * 跨題空白自動歸屬前一題，保證時間軸連續唔漏音）。
 */
export function buildSegments(
  fullWav: Buffer,
  timeline: { questionId: string; from: number; to: number }[]
): Map<string, { buffer: Buffer; startSec: number; endSec: number }> {
  const out = new Map<string, { buffer: Buffer; startSec: number; endSec: number }>();
  if (!isPcmWav(fullWav) || timeline.length === 0) return out;
  const duration = (fullWav.length - HEADER_SIZE) / (wavSampleRate(fullWav) * 2);
  for (let i = 0; i < timeline.length; i++) {
    const seg = timeline[i];
    // 區間 = 本題停留 [from, 下一題 from 或視頻結束)
    const next = timeline[i + 1];
    const start = Math.max(0, Math.min(seg.from, duration));
    const end = Math.max(start, Math.min(next ? next.from : duration, duration));
    if (end - start < 0.5) continue; // 不足半秒，跳過
    // 同題多次停留（翻題重答）→ 取最新區間（後寫覆蓋）
    out.set(seg.questionId, {
      buffer: sliceWavSegment(fullWav, start, end),
      startSec: Math.round(start),
      endSec: Math.round(end),
    });
  }
  return out;
}
