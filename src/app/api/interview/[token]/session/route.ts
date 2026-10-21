import { after } from "next/server";
import { getSupabase } from "@/lib/booking/db";
import { INTERVIEW_BUCKET } from "@/app/api/admin/interviews/route";
import { generateCv, generateReport, segmentAnswers, transcribeAudio, transcribeVideo } from "@/lib/interview/ai";
import { toUserMessage } from "@/lib/interview/ai-errors";
import { getInterviewByToken, getQuestionsForInterview } from "@/lib/interview/store";
import { buildSegments } from "@/lib/interview/wav-segment";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 後台任務：整場音頻轉寫（可能 10+ 分鐘）+ 切分 + 報告
// Gemini API 封鎖香港區域，函數跑新加坡節點繞開（其他區域無影響）
export const preferredRegion = "sin1";

/**
 * POST /api/interview/[token]/session
 * body: { videoPath, audioPath?, events?: { questionId, at }[] }
 *
 * 全程一次連續錄製嘅統一提交（後台任務模式）：
 * 1. 樂觀鎖認領：interviews.status pending/in_progress → processing（防併發重複跑）
 * 2. 秒回 { ok: true, processing: true } —— 用戶上傳完即刻可以閂頁
 * 3. after() 後台慢慢跑：整段轉寫 → LLM 按題切分 → 寫作答 → 生成整體報告 → 標記完成
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
    return Response.json({ ok: true, processing: false }); // 冪等：已完成直接畀過
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

  const questions = await getQuestionsForInterview(interview);

  // ---- 認領提交：第一句 update 成功先代表本請求獨佔後台任務 ----
  const { data: claimed, error: claimErr } = await supabase
    .from("interviews")
    .update({ status: "processing" })
    .eq("id", interview.id)
    .in("status", ["pending", "in_progress"])
    .select("id");
  if (claimErr) {
    // DB 層錯誤（如約束未加 processing）要如實報俾前端重試，唔好靜默假裝已受理
    console.error("[interview] 認領提交失敗:", claimErr);
    return Response.json({ error: "提交初始化失敗，請重試" }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    // 已經 processing（前一個提交正在後台跑）或已被併發標記完成：冪等放行，唔重複跑
    return Response.json({ ok: true, processing: true });
  }

  // ---- 後台任務：響應秒返之後繼續跑（同一函數調用的 waitUntil 生命週期） ----
  const interviewId = interview.id;
  after(async () => {
    const supa = getSupabase();
    if (!supa) return;
    const finishFailed = async (reason: unknown) => {
      console.error("[interview] 後台解析整體失敗（以 fallback 標記完成）:", reason);
      await supa
        .from("interviews")
        .update({
          status: "completed",
          report: {
            score: 0,
            summary: "整體報告生成失敗，請聯絡管理員重新生成或參考逐題結果。",
            strengths: [],
            concerns: [],
            resumeMatch: "",
            recommendation: "",
            generatedBy: "none",
          },
          completed_at: new Date().toISOString(),
        })
        .eq("id", interviewId);
    };

    try {
      // ---- 1) 整段轉寫（失敗唔阻流程：照樣標記完成，報告標註無轉寫） ----
      let transcript = "";
      let warning: string | undefined;
      /** 整場 WAV 原始 buffer（切段用；冇音頻時為 null） */
      let fullWav: Buffer | null = null;

      // 路線 1（優先）：客戶端預抽嘅 WAV → MiniMax asr-1.0 / 硅基流動
      if (audioPath) {
        const { data: audioData, error: audioErr } = await supa.storage
          .from(INTERVIEW_BUCKET)
          .download(audioPath);
        if (audioErr || !audioData) {
          console.error("[interview] 音頻下載失敗（回落視頻轉寫）:", audioErr);
        } else {
          const wavBuffer = Buffer.from(await audioData.arrayBuffer());
          try {
            transcript = await transcribeAudio(
              wavBuffer,
              audioPath.split("/").pop() || "session.wav"
            );
          } catch (e) {
            console.error("[interview] 音頻轉寫失敗（回落視頻轉寫）:", e);
            warning = toUserMessage(e);
          }
          // 轉寫成唔成功都留住 buffer：切段靠時間線，唔依賴轉寫
          if (wavBuffer.length > 44) fullWav = wavBuffer;
        }
      }

      // 路線 2（兜底）：冇音頻或轉寫為空 → 視頻轉寫鏈（硅基流動 → Gemini 直接吃視頻）
      if (!transcript) {
        const { data: videoData, error: dlErr } = await supa.storage
          .from(INTERVIEW_BUCKET)
          .download(videoPath);
        if (dlErr || !videoData) {
          console.error("[interview] 後台視頻下載失敗:", dlErr);
          await finishFailed(dlErr);
          return;
        }
        const videoBuffer = Buffer.from(await videoData.arrayBuffer());
        try {
          transcript = await transcribeVideo(
            videoBuffer,
            videoPath.split("/").pop() || "session.webm",
            videoData.type
          );
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

      // ---- 3) 按時間線切出每題音頻段（僱主逐題試聽用；失敗唔阻流程） ----
      // timeline 事件：每次切題都記錄 from/to，轉成「該題停留區間」
      const timeline = events
        .slice()
        .sort((a, b) => a.at - b.at)
        .map((e, i, arr) => ({
          questionId: e.questionId,
          from: e.at,
          to: arr[i + 1] ? arr[i + 1].at : Number.MAX_SAFE_INTEGER,
        }))
        .filter((e) => e.to > e.from);
      const segMap = new Map<string, { buffer: Buffer; startSec: number; endSec: number }>();
      const audioSegPaths = new Map<string, { path: string; start: number; end: number }>();
      if (fullWav && timeline.length > 0) {
        try {
          const segments = buildSegments(
            fullWav,
            timeline.map((t) => ({ questionId: t.questionId, from: t.from, to: t.to }))
          );
          for (const [qid, seg] of segments) {
            const segPath = `videos/${interviewId}/segments/${qid}.wav`;
            const { error: upErr } = await supa.storage
              .from(INTERVIEW_BUCKET)
              .upload(segPath, new Uint8Array(seg.buffer), {
                contentType: "audio/wav",
                upsert: true,
              });
            if (upErr) {
              console.error(`[interview] 音頻段上傳失敗 (${qid}):`, upErr);
              continue;
            }
            audioSegPaths.set(qid, { path: segPath, start: seg.startSec, end: seg.endSec });
          }
          console.log(`[interview] 音頻切段完成: ${audioSegPaths.size}/${timeline.length}`);
        } catch (e) {
          console.error("[interview] 音頻切段失敗（不影響轉錄與報告）:", e);
        }
      }

      // ---- 4) 寫入逐題作答（冪等：先清掉可能嘅舊記錄，再重新插入） ----
      await supa.from("interview_answers").delete().eq("interview_id", interviewId);
      if (questions.length > 0) {
        await supa.from("interview_answers").insert(
          questions.map((q) => {
            const seg = audioSegPaths.get(q.id);
            return {
              interview_id: interviewId,
              question_id: q.id,
              question_text: q.question,
              attempt: 1,
              video_path: videoPath,
              transcript: segmented[q.id] || "",
              passed: true,
              feedback: null,
              // 整場錄製定位信息：音頻段 + 起止秒數（切唔到段時為 null）
              audio_path: seg?.path ?? null,
              video_start: seg?.start ?? null,
              video_end: seg?.end ?? null,
            };
          })
        );
      }

      // ---- 4) 生成整體報告（失敗唔卡住面試：fallback 標記完成） ----
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

      // ---- 5) Advanced（自製 CV）：按作答生成結構化 CV（失敗唔卡住面試） ----
      let cv: unknown = null;
      if (interview.plan === "advanced") {
        try {
          cv = await generateCv(interview.worker_name, qaList);
        } catch (e) {
          console.error("[interview] CV 生成失敗（面試照常完成）:", e);
        }
      }

      await supa
        .from("interviews")
        .update({ status: "completed", report, cv, completed_at: new Date().toISOString() })
        .eq("id", interviewId);
      console.log(`[interview] 後台解析完成: ${interviewId}`);
    } catch (e) {
      await finishFailed(e);
    }
  });

  // 秒回：前端立刻放行（遮罩解除、進入「已提交」狀態）
  return Response.json({ ok: true, processing: true });
}
