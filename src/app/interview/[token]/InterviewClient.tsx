"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CircleCheck,
  Languages,
  Mic,
  RotateCcw,
  Send,
  TriangleAlert,
  Video,
  Volume2,
} from "lucide-react";
import Logo from "@/components/brand/Logo";
import {
  DEFAULT_LOCALE,
  LOCALES,
  UI_STRINGS,
  tstr,
  type LocaleKey,
} from "@/lib/interview/i18n";

interface Question {
  id: string;
  question: string;
  /** 各語言譯文 */
  translations: Record<string, string>;
  /** 各語言 TTS 音頻簽名 URL */
  audio: Record<string, string>;
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
  | { name: "processing"; step: "upload" | "analyze"; pct: number }
  | { name: "finished" };

/** PUT 直傳（帶真實進度回調） */
function uploadWithProgress(
  url: string,
  blob: Blob,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("視頻上傳失敗，請檢查網絡後重試"));
    xhr.onerror = () => reject(new Error("視頻上傳失敗，請檢查網絡後重試"));
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", blob);
    xhr.send(form);
  });
}

const BTN_PRIMARY =
  "inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#35a07a] px-6 py-3 text-[14.5px] font-bold text-white transition-colors hover:bg-[#2a8163] disabled:cursor-not-allowed disabled:opacity-60";
const BTN_OUTLINE =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#e6e9f2] bg-white px-5 py-3 text-[14px] font-semibold text-[#3d4763] transition-colors hover:border-[#35a07a]/50 hover:text-[#2a8163] disabled:cursor-not-allowed disabled:opacity-60";

/** 工人端視頻面試（免登入，多語言）：逐題錄製 → AI 分析 → 整體報告 */
export default function InterviewClient({ token }: { token: string }) {
  const [info, setInfo] = useState<InterviewInfo | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [lang, setLang] = useState<LocaleKey>(DEFAULT_LOCALE);
  const [playing, setPlaying] = useState(false);

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const t = useCallback(
    (key: string, vars: Record<string, string | number> = {}) =>
      tstr(UI_STRINGS[lang][key] ?? UI_STRINGS[DEFAULT_LOCALE][key] ?? key, vars),
    [lang]
  );

  const currentQ: Question | null = info
    ? info.questions.find((q) => !info.progress[q.id]?.passed) || null
    : null;
  const attemptsUsed = currentQ ? info?.progress[currentQ.id]?.attempts || 0 : 0;
  const doneCount = info ? info.questions.filter((q) => info.progress[q.id]?.passed).length : 0;

  /** 只拉取資料、不改階段（答題後的刷新用，避免閃回「面試開始」） */
  const fetchInfo = useCallback(async (): Promise<InterviewInfo | null> => {
    try {
      const res = await fetch(`/api/interview/${token}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhase({ name: "error", message: data.error || `載入失敗（${res.status}），請重試` });
        return null;
      }
      setInfo(data);
      return data as InterviewInfo;
    } catch {
      setPhase({ name: "error", message: "網絡錯誤，無法載入面試資料，請檢查網絡後重試。" });
      return null;
    }
  }, [token]);

  /** 首次/重新載入：按狀態決定階段 */
  const load = useCallback(async () => {
    const data = await fetchInfo();
    if (!data) return;
    setPhase(data.status === "completed" ? { name: "finished" } : { name: "consent" });
  }, [fetchInfo]);

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
    return () => {
      stopStream();
      window.speechSynthesis?.cancel();
    };
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ---------- 題目語音播放（TTS 優先，瀏覽器語音合成兜底） ----------
  const speakFallback = useCallback(
    (text: string) => {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = LOCALES.find((l) => l.key === lang)!.bcp47;
        u.onend = () => setPlaying(false);
        u.onerror = () => setPlaying(false);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    },
    [lang]
  );

  const playQuestion = useCallback(
    (q: Question | null) => {
      if (!q) return;
      const text = q.translations?.[lang] || q.question;
      const url = q.audio?.[lang];
      window.speechSynthesis?.cancel();
      if (url) {
        if (!audioRef.current) audioRef.current = new Audio();
        const a = audioRef.current;
        a.src = url;
        a.onended = () => setPlaying(false);
        a.onerror = () => {
          setPlaying(false);
          speakFallback(text);
        };
        setPlaying(true);
        a.play().catch(() => speakFallback(text));
      } else {
        speakFallback(text);
      }
    },
    [lang, speakFallback]
  );

  // 進入新題目 / 切換語言時自動播放題目
  useEffect(() => {
    if (phase.name === "question" && currentQ) {
      playQuestion(currentQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ?.id, lang, phase.name]);

  // ---------- 錄製 ----------
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
      setError(t("errCamera"));
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

  /** 直傳視頻到 Supabase（簽名 URL，帶進度），再交畀 API 分析 */
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

      // 2) PUT 直傳（真實進度）
      setPhase({ name: "processing", step: "upload", pct: 0 });
      await uploadWithProgress(urlData.signedUrl, videoBlob, (pct) =>
        setPhase({ name: "processing", step: "upload", pct })
      );

      // 3) 提交分析
      setPhase({ name: "processing", step: "analyze", pct: 100 });
      const ansRes = await fetch(`/api/interview/${token}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: currentQ.id, videoPath: urlData.path }),
      });
      const ansData = await ansRes.json();
      if (!ansRes.ok) throw new Error(ansData.error || "分析失敗");

      retake();
      if (!ansData.passed) {
        setFeedback(ansData.feedback || "回答未達要求，請再試一次。");
      }
      await fetchInfo(); // 只刷新資料，不重設階段（避免閃回「面試開始」）
      setPhase({ name: "question" });
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

  // ---------- 語言選擇器 ----------
  const LangSelector = () => (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#8b95ad]">
        <Languages size={14} aria-hidden="true" />
        {t("langLabel")}
      </span>
      {LOCALES.map((l) => (
        <button
          key={l.key}
          type="button"
          onClick={() => setLang(l.key)}
          aria-pressed={lang === l.key}
          className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
            lang === l.key
              ? "border-[#35a07a] bg-[#e9f5f0] text-[#2a8163]"
              : "border-[#e6e9f2] bg-white text-[#5d6b85] hover:border-[#35a07a]/50"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );

  // ---------- 外殼 ----------
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="flex min-h-screen flex-col items-center bg-[#f8f9fc] px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center gap-2">
        <Logo size={30} wordmarkSize={15} />
      </div>
      <div className="w-full max-w-[640px] rounded-2xl border border-[#e6e9f2] bg-white p-6 shadow-[0_2px_12px_rgba(22,27,46,0.05)] sm:p-8">
        {children}
      </div>
      <p className="mt-6 text-[11.5px] text-[#a8b0c2]">{t("footer")}</p>
    </div>
  );

  // ---------- 各階段 ----------
  if (phase.name === "loading") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e9f5f0] border-t-[#35a07a]" />
          <p className="text-[13.5px] text-[#5d6b85]">{t("loading")}</p>
        </div>
      </Shell>
    );
  }

  if (phase.name === "error") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
            <TriangleAlert size={22} aria-hidden="true" />
          </span>
          <p className="text-[14px] leading-[1.8] text-[#3d4763]">{phase.message}</p>
          <button
            type="button"
            className={BTN_PRIMARY}
            onClick={() => {
              setPhase({ name: "loading" });
              void load();
            }}
          >
            {t("reload")}
          </button>
        </div>
      </Shell>
    );
  }

  if (!info) return null;

  if (phase.name === "finished") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e9f5f0] text-[#35a07a]">
            <CircleCheck size={32} aria-hidden="true" />
          </span>
          <h1 className="text-[22px] font-bold text-[#161b2e]">{t("finished")}</h1>
          <p className="max-w-[420px] text-[14px] leading-[1.85] text-[#5d6b85]">
            {t("finishedDesc", { name: info.workerName })}
          </p>
          <p className="mt-2 rounded-full bg-[#e9f5f0] px-4 py-2 text-[13px] font-semibold text-[#2a8163]">
            {t("finishedClose")}
          </p>
        </div>
      </Shell>
    );
  }

  if (phase.name === "consent") {
    return (
      <Shell>
        <LangSelector />
        <p className="mb-1.5 text-[12px] font-bold tracking-[0.16em] text-[#35a07a]">{t("title")}</p>
        <h1 className="text-[22px] font-bold text-[#161b2e]">{t("hello", { name: info.workerName })}</h1>
        <p className="mt-2 text-[14px] leading-[1.85] text-[#5d6b85]">{t("welcome")}</p>

        <ul className="mt-6 flex flex-col gap-3">
          {[
            t("ruleCount", { n: info.questions.length }),
            t("ruleSeconds", { max: MAX_SECONDS, n: MAX_ATTEMPTS }),
            t("ruleAi"),
            t("ruleEnv"),
          ].map((text) => (
            <li
              key={text}
              className="flex items-start gap-3 rounded-xl bg-[#f8f9fc] px-4 py-3 text-[13.5px] leading-[1.7] text-[#3d4763]"
            >
              <CircleCheck size={16} className="mt-0.5 shrink-0 text-[#35a07a]" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>

        <p className="mt-5 rounded-xl border border-[#e6e9f2] px-4 py-3 text-[12px] leading-[1.7] text-[#8b95ad]">
          {t("privacy")}
        </p>

        <button type="button" className={`${BTN_PRIMARY} mt-6`} onClick={() => setPhase({ name: "question" })}>
          {t("agreeStart")}
        </button>
      </Shell>
    );
  }

  if (phase.name === "processing") {
    const isUpload = phase.step === "upload";
    return (
      <Shell>
        <div className="flex flex-col items-center gap-6 py-8 text-center">
          <p className="text-[16px] font-bold text-[#161b2e]">
            {isUpload ? t("stepUpload") : t("stepAnalyze")}
          </p>

          <div className="flex w-full max-w-[420px] flex-col gap-3">
            {/* 步驟 1：上傳視頻 */}
            <div
              className={`rounded-xl border p-4 text-left transition-colors ${
                isUpload ? "border-[#35a07a]/40 bg-[#e9f5f0]/60" : "border-[#e6e9f2] bg-white"
              }`}
            >
              <div className="flex items-center justify-between text-[13px] font-semibold">
                <span className="flex items-center gap-2.5">
                  {isUpload ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#35a07a]/30 border-t-[#35a07a]" />
                  ) : (
                    <CircleCheck size={16} className="text-[#35a07a]" aria-hidden="true" />
                  )}
                  <span className={isUpload ? "text-[#2a8163]" : "text-[#161b2e]"}>{t("stepUpload")}</span>
                </span>
                <span className="font-mono text-[12px] text-[#8b95ad]">
                  {isUpload ? `${phase.pct}%` : "100%"}
                </span>
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#eef1f6]">
                <div
                  className="h-full rounded-full bg-[#35a07a] transition-all duration-200"
                  style={{ width: `${isUpload ? phase.pct : 100}%` }}
                />
              </div>
            </div>

            {/* 步驟 2：AI 分析 */}
            <div
              className={`rounded-xl border p-4 text-left transition-colors ${
                !isUpload ? "border-[#35a07a]/40 bg-[#e9f5f0]/60" : "border-[#e6e9f2] bg-white"
              }`}
            >
              <div className="flex items-center gap-2.5 text-[13px] font-semibold">
                {!isUpload ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#35a07a]/30 border-t-[#35a07a]" />
                ) : (
                  <span className="h-4 w-4 rounded-full border-2 border-[#e6e9f2]" />
                )}
                <span className={!isUpload ? "text-[#2a8163]" : "text-[#8b95ad]"}>{t("stepAnalyze")}</span>
              </div>
              {!isUpload && <div className="mt-2.5 h-1.5 w-full animate-pulse rounded-full bg-[#d7ebdf]" />}
            </div>
          </div>

          <p className="text-[12.5px] text-[#8b95ad]">{t("analyzingHint")}</p>
        </div>
      </Shell>
    );
  }

  // question 階段
  if (!currentQ) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e9f5f0] text-[#35a07a]">
            <CircleCheck size={28} aria-hidden="true" />
          </span>
          <h1 className="text-[20px] font-bold text-[#161b2e]">{t("allDone")}</h1>
          <p className="text-[13.5px] leading-[1.8] text-[#5d6b85]">{t("allDoneDesc")}</p>
          {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}
          <button type="button" className={`${BTN_PRIMARY} mt-1`} disabled={busy} onClick={finish}>
            {busy ? t("submitting") : t("finishSubmit")}
          </button>
        </div>
      </Shell>
    );
  }

  const progressPct = info.questions.length
    ? Math.round((doneCount / info.questions.length) * 100)
    : 0;
  const questionText = currentQ.translations?.[lang] || currentQ.question;

  return (
    <Shell>
      <LangSelector />

      {/* 進度 */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-[12.5px] font-semibold">
          <span className="text-[#161b2e]">
            {t("progressOf", { x: doneCount + 1, n: info.questions.length })}
          </span>
          <span className="text-[#8b95ad]">{t("attemptsLeft", { n: MAX_ATTEMPTS - attemptsUsed })}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eef1f6]">
          <div
            className="h-full rounded-full bg-[#35a07a] transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <h2 className="flex-1 text-[19px] leading-[1.55] font-semibold text-[#161b2e] sm:text-[21px]">
          {questionText}
        </h2>
        <button
          type="button"
          onClick={() => playQuestion(currentQ)}
          aria-label={t("playQuestion")}
          title={playing ? t("replayQuestion") : t("playQuestion")}
          className={`mt-0.5 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors ${
            playing
              ? "border-[#35a07a] bg-[#e9f5f0] text-[#2a8163]"
              : "border-[#e6e9f2] text-[#35a07a] hover:border-[#35a07a]/60"
          }`}
        >
          <Volume2 size={17} aria-hidden="true" className={playing ? "animate-pulse" : ""} />
        </button>
      </div>

      {feedback && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-[1.75] text-amber-800">
          💡 {feedback}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600">
          {error}
        </p>
      )}

      <div className="mt-5">
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
                  className="aspect-video w-full rounded-xl bg-black"
                  playsInline
                  muted
                  autoPlay
                />
                <div className="mt-3 mb-4 flex items-center gap-2 text-[13.5px] font-bold text-red-600">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
                  {t("recordingLeft", { s: secondsLeft })}
                </div>
                <button type="button" className={BTN_PRIMARY} onClick={stopRecording}>
                  {t("doneAnswer")}
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-[#e6e9f2] bg-[#f8f9fc] px-5 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e9f5f0] text-[#35a07a]">
                  <Video size={22} aria-hidden="true" />
                </span>
                <p className="text-[13px] text-[#5d6b85]">{t("recordHint")}</p>
                <button
                  type="button"
                  className={BTN_PRIMARY}
                  onClick={startRecording}
                  disabled={busy || attemptsUsed >= MAX_ATTEMPTS}
                >
                  <Mic size={15} aria-hidden="true" />
                  {t("startRecord")}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <video
              key="preview"
              src={videoUrl}
              controls
              playsInline
              preload="auto"
              className="aspect-video w-full rounded-xl bg-black"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" className={BTN_OUTLINE} onClick={retake} disabled={busy}>
                <RotateCcw size={14} aria-hidden="true" />
                {t("retake")}
              </button>
              <button
                type="button"
                className="btn-primary inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#35a07a] px-6 py-3 text-[14.5px] font-bold text-white transition-colors hover:bg-[#2a8163] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={submitAnswer}
                disabled={busy}
              >
                <Send size={14} aria-hidden="true" />
                {busy ? t("uploading") : t("submitAnswer")}
              </button>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
