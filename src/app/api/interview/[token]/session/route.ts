import { getSupabase } from "@/lib/booking/db";
import { INTERVIEW_BUCKET } from "@/app/api/admin/interviews/route";
import { generateReport, segmentAnswers, transcribeAudio, transcribeVideo } from "@/lib/interview/ai";
import { toUserMessage } from "@/lib/interview/ai-errors";
import { getActiveQuestionsForOwner, getInterviewByToken } from "@/lib/interview/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 整場音頻轉寫（可能 10+ 分鐘）+ 切分 + 報告，畀足時間
// Gemini API 封鎖香港區域，函數跑新加坡節點繞開（其他區域無影響）
export const preferredRegion = "sin1";

/**
 * POST /api/interview/[token]/session
 * body: { videoPath, audioPath?, events?: { questionId, at }[] }
 * 全程一次連續錄製嘅統一提交：
 * 整段轉寫 → LLM 按題切分出逐題回答 → 寫入 interview_answers（共用整場視頻）→
 * 生成整體報告 → 標記面試完成。
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
    return Response.json({ ok: true }); // 冪等：重複提交直接畀過
  }

  let body: {
    videoPath?: string;
    audioPath?: string;
    events?: { questionId?: string; at?: number }[];
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤" }, { status: 400 });
  }
  const { videoPath, audioPath } = body;
  if (!videoPath) {
    return Response.json({ error: "缺少參數" }, { status: 400 });
  }
  // 防越權：路徑必須屬於本場面試
  if (!videoPath.startsWith(`videos/${interview.id}/`)) {
    return Response.json({ error: "無效視頻" }, { status: 400 });
  }
  if (audioPath && !audioPath.startsWith(`videos/${interview.id}/`)) {
    return Response.json({ error: "無效音頻" }, { status: 400 });
  }
  const events = (Array.isArray(body.events) ? body.events : [])
    .filter((e) => typeof e.questionId === "string" && typeof e.at === "number")
    .map((e) => ({ questionId: e.questionId as string, at: Math.max(0, Math.round(e.at as number)) }));

  const questions = await getActiveQuestionsForOwner(interview.customer_id);

  // ---- 1) 整段轉寫（失敗唔阻流程：照樣標記完成，報告標註無轉寫） ----
  let transcript = "";
  let warning: string | undefined;

  // 路線 1（優先）：客戶端預抽嘅 WAV → MiniMax asr-1.0 / 硅基流動
  if (audioPath) {
    const { data: audioData, error: audioErr } = await supabase.storage
      .from(INTERVIEW_BUCKET)
      .download(audioPath);
    if (audioErr || !audioData) {
      console.error("[interview] 音頻下載失敗（回落視頻轉寫）:", audioErr);
    } else {
      try {
        transcript = await transcribeAudio(
          Buffer.from(await audioData.arrayBuffer()),
          audioPath.split("/").pop() || "session.wav"
        );
      } catch (e) {
        console.error("[interview] 音頻轉寫失敗（回落視頻轉寫）:", e);
        warning = toUserMessage(e);
      }
    }
  }

  // 路線 2（兜底）：冇音頻或轉寫為空 → 視頻轉寫鏈（硅基流動 → Gemini 直接吃視頻）
  if (!transcript) {
    const { data: videoData, error: dlErr } = await supabase.storage
      .from(INTERVIEW_BUCKET)
      .download(videoPath);
    if (dlErr || !videoData) {
      console.error("[interview] 視頻下載失敗:", dlErr);
      return Response.json({ error: "視頻讀取失敗，請重新上傳" }, { status: 500 });
    }
    const videoBuffer = Buffer.from(await videoData.arrayBuffer());
    try {
      transcript = await transcribeVideo(videoBuffer, videoPath.split("/").pop() || "session.webm", videoData.type);
    } catch (e) {
      console.error("[interview] 轉寫失敗（仍接受作答）:", e);
      warning = toUserMessage(e);
    }
  }

  // ---- 2) LLM 按題切分出逐題回答（無轉寫/切分失敗 → 該題標「（無轉寫）」） ----
  let segmented: Record<string, string> = {};
  if (transcript) {
    try {
      segmented = await segmentAnswers(
        questions.map((q) => ({ id: q.id, question: q.question })),
        transcript,
        events
      );
    } catch (e) {
      console.error("[interview] 逐題切分失敗（全部標無轉寫）:", e);
      if (!warning) warning = toUserMessage(e);
    }
  }

  // ---- 3) 寫入逐題作答（冪等：先清掉可能嘅舊記錄，再重新插入） ----
  await supabase.from("interview_answers").delete().eq("interview_id", interview.id);
  if (questions.length > 0) {
    await supabase.from("interview_answers").insert(
      questions.map((q) => ({
        interview_id: interview.id,
        question_id: q.id,
        question_text: q.question,
        attempt: 1,
        video_path: videoPath,
        transcript: segmented[q.id] || "",
        passed: true,
        feedback: null,
      }))
    );
  }

  // ---- 4) 生成整體報告（失敗唔卡住面試：fallback 標記完成，詳情透出 warning） ----
  const qaList = questions.map((q) => ({
    question: q.question,
    answer: segmented[q.id] || "（無轉寫）",
  }));
  let report;
  try {
    report = await generateReport(interview.worker_name, interview.resume_text || "", qaList);
  } catch (e) {
    console.error("[interview] 報告生成失敗（以 fallback 標記完成）:", e);
    if (!warning) warning = toUserMessage(e);
    report = {
      score: 0,
      summary: `整體報告生成失敗，請聯絡管理員重新生成或參考逐題結果。\n\n${warning}`,
      strengths: [],
      concerns: [],
      resumeMatch: "",
      recommendation: "",
      generatedBy: "none",
    };
  }

  await supabase
    .from("interviews")
    .update({ status: "completed", report, completed_at: new Date().toISOString() })
    .eq("id", interview.id);

  return Response.json({ ok: true, ...(warning ? { warning } : {}) });
}
