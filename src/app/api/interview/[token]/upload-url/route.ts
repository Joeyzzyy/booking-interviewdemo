import { getSupabase } from "@/lib/booking/db";
import { INTERVIEW_BUCKET } from "@/app/api/admin/interviews/route";
import {
  currentQuestion,
  getActiveQuestions,
  getAnswerProgress,
  getInterviewByToken,
  MAX_ATTEMPTS,
  MAX_VIDEO_SIZE,
  VIDEO_ACCEPT,
} from "@/lib/interview/store";

export const dynamic = "force-dynamic";

/**
 * POST /api/interview/[token]/upload-url
 * body: { questionId, size, contentType }
 * 生成 Supabase 簽名上傳 URL（視頻瀏覽器直傳，繞開 Vercel 4.5MB 限制）。
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

  let body: { questionId?: string; size?: number; contentType?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  if (!body.questionId || !body.size || !body.contentType) {
    return Response.json({ error: "缺少參數" }, { status: 400 });
  }
  // contentType 可能帶 codecs 後綴（如 video/webm;codecs=vp9,opus），前綴匹配
  const baseType = body.contentType.split(";")[0].trim();
  if (!VIDEO_ACCEPT.includes(baseType)) {
    return Response.json({ error: "視頻格式不支持" }, { status: 400 });
  }
  if (body.size > MAX_VIDEO_SIZE) {
    return Response.json({ error: "視頻超過 60MB 上限" }, { status: 400 });
  }

  // 順序作答校驗 + 重試次數
  const questions = await getActiveQuestions();
  const progress = await getAnswerProgress(interview.id);
  const current = currentQuestion(questions, progress);
  if (!current || current.id !== body.questionId) {
    return Response.json({ error: "請按順序作答" }, { status: 409 });
  }
  const attempts = progress[current.id]?.attempts || 0;
  if (attempts >= MAX_ATTEMPTS) {
    return Response.json({ error: "呢條問題已達重試上限" }, { status: 409 });
  }

  const ext = baseType === "video/mp4" ? "mp4" : "webm";
  const path = `videos/${interview.id}/${current.id}-attempt${attempts + 1}.${ext}`;
  const { data, error } = await supabase.storage
    .from(INTERVIEW_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[interview] 簽名上傳 URL 失敗:", error);
    return Response.json({ error: "上傳初始化失敗" }, { status: 500 });
  }
  return Response.json({ signedUrl: data.signedUrl, path, attempt: attempts + 1 });
}
