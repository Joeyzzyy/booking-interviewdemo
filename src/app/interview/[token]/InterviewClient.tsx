"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Question {
  id: string;
  question: string;
}

interface InterviewInfo {
  workerName: string;
  status: "pending" | "in_progress" | "completed";
  questions: Question[];
  progress: Record<string, { attempts: number; passed: boolean }>;
}

const MAX_SECONDS = 90;
const MAX_ATTEMPTS = 3;

type Phase =
  | { name: "loading" }
  | { name: "error"; message: string }
  | { name: "consent" }
  | { name: "question" }
  | { name: "analyzing" }
  | { name: "finished" };

export default function InterviewClient({ token }: { token: string }) {
  const [info, setInfo] = useState<InterviewInfo | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  // 錄製相關
  const [recording, setRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);

  const currentQ: Question | null = info
    ? info.questions.find((q) => !info.progress[q.id]?.passed) || null
    : null;
  const attemptsUsed = currentQ ? info?.progress[currentQ.id]?.attempts || 0 : 0;
  const doneCount = info ? info.questions.filter((q) => info.progress[q.id]?.passed).length : 0;

  const load = useCallback(async () => {
    const res = await fetch(`/api/interview/${token}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      setPhase({ name: "error", message: data.error || "載入失敗" });
      return;
    }
    setInfo(data);
    setPhase(data.status === "completed" ? { name: "finished" } : { name: "consent" });
  }, [token]);

  const stopStream = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void load();
    return () => stopStream();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const startRecording = async () => {
    setError("");
    setFeedback("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        liveVideoRef.current.muted = true;
        await liveVideoRef.current.play().catch(() => {});
      }

      // VP8 優先：部分 Chrome 的 VP9 硬件編碼失敗會輸出 2×2 黑屏視頻
      const mimeType = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((t) =>
        MediaRecorder.isTypeSupported(t)
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        setVideoBlob(blob);
        setVideoUrl(URL.createObjectURL(blob));
        setRecording(false);
        stopStream();
      };
      recorder.start(1000);
      setRecording(true);
      setSecondsLeft(MAX_SECONDS);
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            stopRecording();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch {
      setError("無法開啟鏡頭/咪高峰，請檢查瀏覽器權限後重試。");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const retake = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoBlob(null);
    setVideoUrl("");
    setFeedback("");
  };

  /** 直傳視頻到 Supabase（簽名 URL），再交畀 API 分析 */
  const submitAnswer = async () => {
    if (!videoBlob || !currentQ) return;
    setBusy(true);
    setError("");
    try {
      // 1) 攞簽名上傳 URL
      const urlRes = await fetch(`/api/interview/${token}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQ.id,
          size: videoBlob.size,
          contentType: videoBlob.type || "video/webm",
        }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error || "上傳初始化失敗");

      // 2) PUT 直傳（supabase-js uploadToSignedUrl 同款協議）
      const form = new FormData();
      form.append("cacheControl", "3600");
      form.append("", videoBlob);
      const upRes = await fetch(urlData.signedUrl, { method: "PUT", body: form });
      if (!upRes.ok) throw new Error("視頻上傳失敗，請檢查網絡後重試");

      // 3) 提交分析
      setPhase({ name: "analyzing" });
      const ansRes = await fetch(`/api/interview/${token}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: currentQ.id, videoPath: urlData.path }),
      });
      const ansData = await ansRes.json();
      if (!ansRes.ok) throw new Error(ansData.error || "分析失敗");

      retake();
      if (ansData.passed) {
        await load();
        setPhase({ name: "question" });
      } else {
        setFeedback(ansData.feedback || "回答未達要求，請再試一次。");
        await load();
        setPhase({ name: "question" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失敗，請稍後再試");
      setPhase({ name: "question" });
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/interview/${token}/finish`, { method: "POST" });
      if (res.ok) setPhase({ name: "finished" });
      else setError((await res.json()).error || "提交失敗");
    } finally {
      setBusy(false);
    }
  };

  // ---------- 渲染 ----------
  if (phase.name === "loading") {
    return <div className="iv-page"><p className="iv-center">載入中…</p></div>;
  }
  if (phase.name === "error") {
    return <div className="iv-page"><p className="iv-center">⚠️ {phase.message}</p></div>;
  }
  if (!info) return null;

  if (phase.name === "finished") {
    return (
      <div className="iv-page">
        <div className="iv-card iv-center">
          <div className="booking-success-icon">✓</div>
          <h1>面試已完成</h1>
          <p>多謝你完成視頻面試，{info.workerName}。我哋會盡快通知你結果。</p>
        </div>
      </div>
    );
  }

  if (phase.name === "consent") {
    return (
      <div className="iv-page">
        <div className="iv-card">
          <h1>視頻面試</h1>
          <p>{info.workerName} 你好，歡迎參加家壹僱傭中心嘅視頻面試。</p>
          <ul className="iv-rules">
            <li>共 {info.questions.length} 條問題，請用<strong>普通話、粵語或英文</strong>逐題口頭回答</li>
            <li>每條問題錄製上限 {MAX_SECONDS} 秒，最多可重錄 {MAX_ATTEMPTS} 次</li>
            <li>回答會由 AI 即時分析，通過後先入下一題</li>
            <li>請在安靜、光線充足嘅環境作答，並允許瀏覽器使用鏡頭同咪高峰</li>
          </ul>
          <p className="iv-privacy">
            私隱聲明：你錄製嘅視頻僅用於本次招聘評估，我哋會按《個人資料（私隱）條例》妥善保存及處理。
          </p>
          <button type="button" className="booking-submit" onClick={() => setPhase({ name: "question" })}>
            同意並開始
          </button>
        </div>
      </div>
    );
  }

  if (phase.name === "analyzing") {
    return (
      <div className="iv-page">
        <div className="iv-card iv-center">
          <div className="iv-spinner" />
          <p>AI 分析中，請稍候（約 10 秒）…</p>
        </div>
      </div>
    );
  }

  // question 階段
  if (!currentQ) {
    return (
      <div className="iv-page">
        <div className="iv-card iv-center">
          <h1>全部問題已完成</h1>
          <p>請點擊下面按鈕提交面試，系統會生成整體評估報告。</p>
          {error && <p className="booking-error">{error}</p>}
          <button type="button" className="booking-submit" disabled={busy} onClick={finish}>
            {busy ? "提交中…" : "完成並提交面試"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="iv-page">
      <div className="iv-card">
        <div className="iv-progress">
          第 {doneCount + 1} / {info.questions.length} 題
          <span>（本題剩餘 {MAX_ATTEMPTS - attemptsUsed} 次機會）</span>
        </div>
        <h2 className="iv-question">{currentQ.question}</h2>

        {feedback && <p className="iv-feedback-box">💡 {feedback}</p>}
        {error && <p className="booking-error">{error}</p>}

        {!videoBlob ? (
          <>
            {recording ? (
              <>
                {/* key 區分：否則 React 復用同一 video 元素，殘留 srcObject 導致預覽黑屏 */}
                <video
                  key="live"
                  ref={(el) => {
                    liveVideoRef.current = el;
                    if (el && streamRef.current && el.srcObject !== streamRef.current) {
                      el.srcObject = streamRef.current;
                      el.muted = true;
                      el.play().catch(() => {});
                    }
                  }}
                  className="iv-live"
                  playsInline
                  muted
                  autoPlay
                />
                <div className="iv-rec-bar">
                  <span className="iv-rec-dot" /> 錄製中… 剩餘 {secondsLeft} 秒
                </div>
                <button type="button" className="booking-submit" onClick={stopRecording}>
                  完成作答
                </button>
              </>
            ) : (
              <button
                type="button"
                className="booking-submit"
                onClick={startRecording}
                disabled={busy || attemptsUsed >= MAX_ATTEMPTS}
              >
                🎥 開始錄製回答
              </button>
            )}
          </>
        ) : (
          <>
            <video key="preview" src={videoUrl} controls playsInline preload="auto" className="iv-live" />
            <div className="iv-actions">
              <button type="button" className="booking-modal-back" onClick={retake} disabled={busy}>
                重新錄製
              </button>
              <button type="button" className="booking-modal-confirm iv-submit" onClick={submitAnswer} disabled={busy}>
                {busy ? "上傳中…" : "提交回答"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
