import { getSupabase } from "@/lib/booking/db";
import { INTERVIEW_BUCKET } from "@/app/api/admin/interviews/route";
import {
  getActiveQuestionsForOwner,
  getAnswerProgress,
  getInterviewByToken,
} from "@/lib/interview/store";

export const dynamic = "force-dynamic";

/** GET /api/interview/[token] — 面試信息 + 題目（含譯文與音頻）+ 進度（工人端，免登入） */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return Response.json({ error: "無效連結" }, { status: 404 });
  }
  const supabase = getSupabase();
  if (!supabase) return Response.json({ error: "服務暫時不可用" }, { status: 503 });

  const interview = await getInterviewByToken(token);
  if (!interview) return Response.json({ error: "連結不存在或已失效" }, { status: 404 });

  // 按該場面試的歸屬人取題（面試屬於哪位用戶，就用誰的題庫）
  const questions = await getActiveQuestionsForOwner(interview.customer_id);
  const progress = await getAnswerProgress(interview.id);

  // 批量生成 TTS 音頻簽名 URL（1 小時）
  const allPaths = questions
    .flatMap((q) => Object.values(q.audio || {}))
    .filter(Boolean);
  const urlMap = new Map<string, string>();
  if (allPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(INTERVIEW_BUCKET)
      .createSignedUrls(allPaths, 3600);
    for (const s of signed || []) {
      if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl);
    }
  }

  return Response.json(
    {
      workerName: interview.worker_name,
      status: interview.status,
      questions: questions.map((q) => {
        const audioUrls: Record<string, string> = {};
        for (const [lang, path] of Object.entries(q.audio || {})) {
          const url = urlMap.get(path);
          if (url) audioUrls[lang] = url;
        }
        return {
          id: q.id,
          question: q.question,
          translations: q.translations || {},
          audio: audioUrls,
        };
      }),
      progress,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
