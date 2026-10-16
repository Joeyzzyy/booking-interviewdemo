import { getSupabase } from "@/lib/booking/db";
import { INTERVIEW_BUCKET } from "@/app/api/admin/interviews/route";
import { getInterviewByToken, VIDEO_ACCEPT } from "@/lib/interview/store";

export const dynamic = "force-dynamic";

/** 整場連續錄製：視頻上限 200MB（≈70KB/s 碼率下 45 分鐘綽綽有餘） */
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;
/** 整場 WAV 音頻上限 48MB（16kHz mono 16-bit ≈ 32KB/s，25 分鐘綽綽有餘） */
const MAX_AUDIO_SIZE = 48 * 1024 * 1024;

/**
 * POST /api/interview/[token]/upload-url
 * body: { kind: "session", size, contentType }
 * 生成 Supabase 簽名上傳 URL（整場視頻/音頻瀏覽器直傳，繞開 Vercel 4.5MB 限制）。
 * contentType 支持視頻（webm/mp4）及 audio/wav（客戶端提取嘅純音頻，畀 STT 用）。
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

  let body: { kind?: string; size?: number; contentType?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  if (body.kind !== "session" || !body.size || !body.contentType) {
    return Response.json({ error: "缺少參數" }, { status: 400 });
  }
  // contentType 可能帶 codecs 後綴（如 video/webm;codecs=vp9,opus），前綴匹配
  const baseType = body.contentType.split(";")[0].trim();
  const isAudio = baseType === "audio/wav";
  if (!isAudio && !VIDEO_ACCEPT.includes(baseType)) {
    return Response.json({ error: "視頻格式不支持" }, { status: 400 });
  }
  if (isAudio && body.size > MAX_AUDIO_SIZE) {
    return Response.json({ error: "音頻超過 48MB 上限" }, { status: 400 });
  }
  if (!isAudio && body.size > MAX_VIDEO_SIZE) {
    return Response.json({ error: "視頻超過 200MB 上限" }, { status: 400 });
  }

  const ext = isAudio ? "wav" : baseType === "video/mp4" ? "mp4" : "webm";
  const path = `videos/${interview.id}/session.${ext}`;
  const { data, error } = await supabase.storage
    .from(INTERVIEW_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[interview] 簽名上傳 URL 失敗:", error);
    return Response.json({ error: "上傳初始化失敗" }, { status: 500 });
  }
  return Response.json({ signedUrl: data.signedUrl, path });
}
