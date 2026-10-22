import { getSupabase } from "@/lib/booking/db";
import { INTERVIEW_BUCKET } from "@/app/api/admin/interviews/route";
import {
  getInterviewByToken,
  MAX_PHOTO_SIZE,
  PHOTO_ACCEPT,
  VIDEO_ACCEPT,
} from "@/lib/interview/store";

export const dynamic = "force-dynamic";

/** 整場連續錄製：視頻上限 200MB（≈70KB/s 碼率下 45 分鐘綽綽有餘） */
const MAX_SESSION_VIDEO_SIZE = 200 * 1024 * 1024;
/** 整場 WAV 音頻上限 48MB（16kHz mono 16-bit ≈ 32KB/s，25 分鐘綽綽有餘） */
const MAX_SESSION_AUDIO_SIZE = 48 * 1024 * 1024;
/** 逐題模式單題視頻上限 30MB（90 秒 @500kbps ≈ 5.6MB，留足餘量） */
const MAX_QUESTION_VIDEO_SIZE = 30 * 1024 * 1024;

const QUESTION_ID_RE = /^[A-Za-z0-9-]{1,64}$/;

/**
 * POST /api/interview/[token]/upload-url
 * body:
 *  - 整場錄製：{ kind: "session", size, contentType }
 *  - 逐題錄製：{ kind: "question", questionId, attempt?, size, contentType }
 *  - 作品照片：{ kind: "photo", photoKey, size, contentType }  photoKey: dish-1 / dish-2 / dish-3 / work-1 / work-2
 * 生成 Supabase 簽名上傳 URL（瀏覽器直傳，繞開 Vercel 4.5MB 限制）。
 * contentType 支持視頻（webm/mp4）、audio/wav（客戶端提取嘅純音頻）及作品照片（jpeg/png）。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "服務暫時不可用" }, { status: 503 });
  const interview = await getInterviewByToken(token);
  if (!interview) return Response.json({ error: "連結不存在" }, { status: 404 });
  if (interview.status === "completed") {
    return Response.json({ error: "面試已完成" }, { status: 409 });
  }

  let body: {
    kind?: string;
    questionId?: string;
    attempt?: number;
    photoKey?: string;
    size?: number;
    contentType?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  if (!body.kind || !body.size || !body.contentType) {
    return Response.json({ error: "缺少參數" }, { status: 400 });
  }
  // contentType 可能帶 codecs 後綴（如 video/webm;codecs=vp9,opus），前綴匹配
  const baseType = body.contentType.split(";")[0].trim();
  const isAudio = baseType === "audio/wav";
  const isPhoto = PHOTO_ACCEPT.includes(baseType);
  if (!isAudio && !isPhoto && !VIDEO_ACCEPT.includes(baseType)) {
    return Response.json({ error: "文件格式不支持" }, { status: 400 });
  }

  let path = "";
  if (body.kind === "session") {
    if (isPhoto) return Response.json({ error: "文件格式不支持" }, { status: 400 });
    if (isAudio && body.size > MAX_SESSION_AUDIO_SIZE) {
      return Response.json({ error: "音頻超過 48MB 上限" }, { status: 400 });
    }
    if (!isAudio && body.size > MAX_SESSION_VIDEO_SIZE) {
      return Response.json({ error: "視頻超過 200MB 上限" }, { status: 400 });
    }
    const ext = isAudio ? "wav" : baseType === "video/mp4" ? "mp4" : "webm";
    path = `videos/${interview.id}/session.${ext}`;
  } else if (body.kind === "question") {
    // 逐題模式：僅允許 per-question 面試；視頻 or 純音頻，唔收照片
    if (interview.mode !== "per-question") {
      return Response.json({ error: "此面試模式不支持逐題上傳" }, { status: 400 });
    }
    if (isPhoto || !body.questionId || !QUESTION_ID_RE.test(body.questionId)) {
      return Response.json({ error: "缺少參數" }, { status: 400 });
    }
    const attempt = Math.min(Math.max(Math.floor(body.attempt || 1), 1), 4);
    if (isAudio && body.size > MAX_SESSION_AUDIO_SIZE) {
      return Response.json({ error: "音頻超過 48MB 上限" }, { status: 400 });
    }
    if (!isAudio && body.size > MAX_QUESTION_VIDEO_SIZE) {
      return Response.json({ error: "視頻超過 30MB 上限" }, { status: 400 });
    }
    const ext = isAudio ? "wav" : baseType === "video/mp4" ? "mp4" : "webm";
    path = `videos/${interview.id}/q/${body.questionId}-a${attempt}.${ext}`;
  } else if (body.kind === "photo") {
    // 作品照片：僅允許 per-question 面試；僅收 jpeg/png
    if (interview.mode !== "per-question") {
      return Response.json({ error: "此面試模式不支持照片上傳" }, { status: 400 });
    }
    if (!isPhoto || !body.photoKey || !/^(dish|work)-[1-3]$/.test(body.photoKey)) {
      return Response.json({ error: "缺少參數" }, { status: 400 });
    }
    if (body.size > MAX_PHOTO_SIZE) {
      return Response.json({ error: "照片超過 10MB 上限" }, { status: 400 });
    }
    const ext = baseType === "image/png" ? "png" : "jpg";
    path = `photos/${interview.id}/${body.photoKey}.${ext}`;
  } else {
    return Response.json({ error: "缺少參數" }, { status: 400 });
  }

  // upsert：同一題重答 / 同序號照片重傳時直接覆蓋
  //（默認簽名上傳 URL 對已存在對象報 409 KeyAlreadyExists）
  const { data, error } = await supabase.storage
    .from(INTERVIEW_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error || !data) {
    console.error("[interview] 簽名上傳 URL 失敗:", error);
    return Response.json({ error: "上傳初始化失敗" }, { status: 500 });
  }
  return Response.json({ signedUrl: data.signedUrl, path });
}
