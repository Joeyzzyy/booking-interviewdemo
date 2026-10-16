"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleCheck,
  Languages,
  Mic,
  Send,
  TriangleAlert,
  Video,
  Volume2,
} from "lucide-react";
import Logo from "@/components/brand/Logo";
import { brandName } from "@/lib/brand";
import { blobToWav } from "@/lib/audio/wav";
import {
  DEFAULT_LOCALE,
  LOCALES,
  UI_STRINGS,
  tstr,
  type LocaleKey,
} from "@/lib/interview/i18n";
import { sectionLabel } from "@/lib/interview/shared-questions";

interface Question {
  id: string;
  question: string;
  /** 分類 key（公共題庫 = 表單章節；自定義題目為 null） */
  category?: string | null;
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

type Phase =
  | { name: "loading" }
  | { name: "error"; message: string }
  | { name: "consent" }
  | { name: "setup" }
  | { name: "question" }
  | { name: "processing"; step: "upload" | "analyze"; pct: number }
  | { name: "finished" };

/** 設備檢查狀態：請求權限中 → 被拒（無法開始）→ 就緒 */
type SetupState = "asking" | "denied" | "ready";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

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

// 連續錄製碼率限制：控制整場面試文件體積（≈70KB/s，15 分鐘 ≈ 63MB）
const VIDEO_BPS = 500_000;
const AUDIO_BPS = 64_000;

/** 頁面外殼（模塊級穩定組件：內聯創建會令子樹每次渲染重掛載，視頻預覽會黑屏） */
function Shell({
  children,
  lang,
  footerText,
}: {
  children: React.ReactNode;
  lang: LocaleKey;
  footerText: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-[#f8f9fc] px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center gap-2">
        <Logo size={30} wordmarkSize={15} name={brandName(lang)} />
      </div>
      <div className="w-full max-w-[640px] rounded-2xl border border-[#e6e9f2] bg-white p-6 shadow-[0_2px_12px_rgba(22,27,46,0.05)] sm:p-8">
        {children}
      </div>
      <p className="mt-6 text-[11.5px] text-[#a8b0c2]">{footerText}</p>
    </div>
  );
}

/** 語言選擇器（模塊級穩定組件） */
function LangSelector({
  lang,
  onChange,
  label,
}: {
  lang: LocaleKey;
  onChange: (l: LocaleKey) => void;
  label: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#8b95ad]">
        <Languages size={14} aria-hidden="true" />
        {label}
      </span>
      {LOCALES.map((l) => (
        <button
          key={l.key}
          type="button"
          onClick={() => onChange(l.key)}
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
}

/**
 * 工人端視頻面試（免登入，多語言）：
 * 設備檢查（強制鏡頭+咪高峰測試）→ 全程一次連續錄製，自由切換上下題 → 結束統一提交分析
 */
export default function InterviewClient({ token }: { token: string }) {
  const [info, setInfo] = useState<InterviewInfo | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [error, setError] = useState("");
  /** AI 相關的非阻斷警告（轉寫/報告失敗等）：友善提示 + 詳情，供截圖診斷 */
  const [warning, setWarning] = useState("");
  const [lang, setLang] = useState<LocaleKey>(DEFAULT_LOCALE);
  const [playing, setPlaying] = useState(false);

  // 設備檢查
  const [setupState, setSetupState] = useState<SetupState>("asking");
  const [micLevel, setMicLevel] = useState(0);
  const [micTestState, setMicTestState] = useState<"idle" | "recording" | "playing">("idle");
  const [micTestUrl, setMicTestUrl] = useState("");

  // 全程錄製相關
  const [qIndex, setQIndex] = useState(0);
  const [visitedIds, setVisitedIds] = useState<string[]>([]);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [busy, setBusy] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef(0);
  const eventsRef = useRef<{ questionId: string; at: number }[]>([]);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const setupVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const micTestChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelRafRef = useRef(0);
  const micLevelLastRef = useRef(-1);

  const t = useCallback<Translate>(
    (key, vars = {}) =>
      tstr(UI_STRINGS[lang][key] ?? UI_STRINGS[DEFAULT_LOCALE][key] ?? key, vars),
    [lang]
  );

  const questions = info?.questions ?? [];
  const currentQ: Question | null = questions[qIndex] ?? null;
  const isLast = qIndex >= questions.length - 1;
  const unansweredCount = questions.length - visitedIds.length;

  /** 題目結構：連續相同分類歸為一個「系列」（自定義題目歸入 custom 系列，排最後） */
  const sections = useMemo(() => {
    if (!info) return [] as { key: string; count: number }[];
    const out: { key: string; count: number }[] = [];
    for (const q of info.questions) {
      const key = q.category || "custom";
      if (out.length && out[out.length - 1].key === key) out[out.length - 1].count += 1;
      else out.push({ key, count: 1 });
    }
    return out;
  }, [info]);

  /** 系列顯示名（跟隨工人端語言；custom = 附加問題） */
  const sectionName = useCallback(
    (key: string) => (key === "custom" ? t("customSection") : sectionLabel(key, lang)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang]
  );

  /** 當前題目所屬系列（1-based，供「系列 x/s」顯示） */
  const currentSectionIdx = currentQ
    ? sections.findIndex((s) => s.key === (currentQ.category || "custom")) + 1
    : 0;

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
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    cancelAnimationFrame(levelRafRef.current);
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

  // 進入新題目 / 切換語言時自動播放題目（僅作答階段；延後到宏任務，唔喺 effect 同步觸發 setState）
  useEffect(() => {
    if (phase.name !== "question" || !currentQ) return;
    const id = setTimeout(() => playQuestion(currentQ), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ?.id, lang, phase.name]);

  // ---------- 設備檢查：鏡頭 + 咪高峰 ----------
  const attachStream = (stream: MediaStream) => {
    for (const ref of [setupVideoRef, liveVideoRef]) {
      if (ref.current) {
        ref.current.srcObject = stream;
        ref.current.muted = true;
        void ref.current.play().catch(() => {});
      }
    }
  };

  /** 咪高峰實時音量條（AnalyserNode RMS；按 5% 檔位降頻寫 state，避免 60fps 重渲染） */
  const startMicMonitor = (stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const level = Math.min(1, Math.sqrt(sum / buf.length) * 3);
        const bucket = Math.round(level * 20) / 20;
        if (bucket !== micLevelLastRef.current) {
          micLevelLastRef.current = bucket;
          setMicLevel(bucket);
        }
        levelRafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      // 音量條失敗唔阻流程
    }
  };

  // 作答階段掛載後，畫中畫 video 元素係新節點，需重新綁定流（setup 階段綁定嘅係舊節點）
  useEffect(() => {
    if (phase.name === "question" && streamRef.current) {
      attachStream(streamRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.name]);

  /** 進入設備檢查：必須攞到鏡頭 + 咪高峰，否則唔畀開始 */
  const requestDevices = async () => {
    setSetupState("asking");
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      attachStream(stream);
      startMicMonitor(stream);
      setSetupState("ready");
    } catch {
      setSetupState("denied");
    }
  };

  // 進入 setup 階段自動請求設備權限（延後到宏任務）
  useEffect(() => {
    if (phase.name !== "setup") return;
    const id = setTimeout(() => void requestDevices(), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.name]);

  /** 咪高峰試錄 3 秒並回放 */
  const micTest = () => {
    const stream = streamRef.current;
    if (!stream || micTestState === "recording") return;
    if (micTestUrl) {
      const a = new Audio(micTestUrl);
      setMicTestState("playing");
      a.onended = () => setMicTestState("idle");
      a.onerror = () => setMicTestState("idle");
      void a.play().catch(() => setMicTestState("idle"));
      return;
    }
    try {
      const recorder = new MediaRecorder(stream);
      micTestChunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && micTestChunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(micTestChunksRef.current, { type: recorder.mimeType });
        setMicTestUrl(URL.createObjectURL(blob));
        setMicTestState("idle");
      };
      recorder.start();
      setMicTestState("recording");
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 3000);
    } catch {
      setMicTestState("idle");
    }
  };

  // ---------- 全程連續錄製 ----------
  /** 記錄到訪題目與切題時間線（畀後端切分參考） */
  const markVisit = (q: Question) => {
    setVisitedIds((prev) => (prev.includes(q.id) ? prev : [...prev, q.id]));
    if (!eventsRef.current.some((e) => e.questionId === q.id)) {
      eventsRef.current.push({
        questionId: q.id,
        at: Math.round((Date.now() - recordStartRef.current) / 1000),
      });
    }
  };

  const startSession = () => {
    const stream = streamRef.current;
    if (!stream || questions.length === 0) return;
    // VP8 優先：部分 Chrome 的 VP9 硬件編碼失敗會輸出 2×2 黑屏視頻
    const mimeType = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((m) =>
      MediaRecorder.isTypeSupported(m)
    );
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: VIDEO_BPS,
      audioBitsPerSecond: AUDIO_BPS,
    });
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    recorder.start(1000);
    recordStartRef.current = Date.now();
    eventsRef.current = [];
    setVisitedIds([]);
    setQIndex(0);
    setConfirmFinish(false);
    markVisit(questions[0]);
    setPhase({ name: "question" });
  };

  /** 切題（用戶手勢）：記錄到訪與時間線事件 */
  const gotoQuestion = (next: number) => {
    const q = questions[next];
    if (!q) return;
    setConfirmFinish(false);
    setQIndex(next);
    markVisit(q);
  };

  /** 停止錄製並攞到整段視頻 blob */
  const stopSessionRecording = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state !== "recording") {
        resolve(chunksRef.current.length ? new Blob(chunksRef.current, { type: "video/webm" }) : null);
        return;
      }
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" }));
      };
      recorder.stop();
    });

  /** 完成面試：停止錄製 → 整段視頻 + 音頻上傳 → 後端統一轉寫切分 → 生成報告 */
  const submitSession = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const videoBlob = await stopSessionRecording();
      if (!videoBlob || videoBlob.size === 0) throw new Error("錄製失敗，請重新開始面試");

      // 1) 攞整場視頻嘅簽名上傳 URL
      const urlRes = await fetch(`/api/interview/${token}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "session",
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

      // 2b) 提取純音頻（16kHz mono WAV）並上傳（盡力而為：STT 唔吃視頻容器；失敗唔阻流程，服務端回落視頻轉寫）
      let audioPath: string | undefined;
      try {
        const wav = await blobToWav(videoBlob);
        const audioUrlRes = await fetch(`/api/interview/${token}/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "session", size: wav.size, contentType: "audio/wav" }),
        });
        if (audioUrlRes.ok) {
          const audioUrlData = await audioUrlRes.json();
          await uploadWithProgress(audioUrlData.signedUrl, wav, () => {});
          audioPath = audioUrlData.path;
        }
      } catch {
        /* 冇音頻都照提交（服務端用舊視頻轉寫鏈） */
      }

      // 3) 提交統一分析（轉寫 → 按題切分 → 寫作答 → 生成整體報告 → 標記完成）
      setPhase({ name: "processing", step: "analyze", pct: 100 });
      const res = await fetch(`/api/interview/${token}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath: urlData.path, audioPath, events: eventsRef.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "分析失敗");
      if (data.warning) setWarning(data.warning);
      stopStream();
      setPhase({ name: "finished" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失敗，請稍後再試");
      setPhase({ name: "question" });
    } finally {
      setBusy(false);
    }
  };

  // ---------- 各階段 ----------
  let body: React.ReactNode;

  if (phase.name === "loading") {
    body = (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e9f5f0] border-t-[#35a07a]" />
        <p className="text-[13.5px] text-[#5d6b85]">{t("loading")}</p>
      </div>
    );
  } else if (phase.name === "error") {
    body = (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <TriangleAlert size={36} className="text-[#d64545]" aria-hidden="true" />
        <p className="text-[14px] leading-[1.8] text-[#3d4763]">{phase.message}</p>
        <button type="button" onClick={() => window.location.reload()} className={BTN_OUTLINE}>
          {t("reload")}
        </button>
      </div>
    );
  } else if (phase.name === "finished") {
    body = (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CircleCheck size={44} className="text-[#35a07a]" aria-hidden="true" />
        <h1 className="text-[20px] font-bold text-[#161b2e]">{t("finished")}</h1>
        <p className="max-w-[42ch] text-[14px] leading-[1.9] text-[#3d4763]">
          {t("finishedDesc", { name: info?.workerName || "" })}
        </p>
        {warning && (
          <p className="max-w-[46ch] rounded-xl border border-[#f0d79a] bg-[#fdf6e3] px-4 py-3 text-left text-[12.5px] leading-[1.7] text-[#8a6d1a]">
            {warning}
          </p>
        )}
        <p className="text-[12.5px] text-[#8b95ad]">{t("finishedClose")}</p>
      </div>
    );
  } else if (phase.name === "consent") {
    body = (
      <>
        <LangSelector lang={lang} onChange={setLang} label={t("langLabel")} />
        <h1 className="text-[20px] font-bold text-[#161b2e]">{t("title")}</h1>
        <p className="mt-1 text-[15px] font-semibold text-[#35a07a]">
          {t("hello", { name: info?.workerName || "" })}
        </p>
        <p className="mt-4 text-[14px] leading-[1.9] text-[#3d4763]">{t("welcome")}</p>
        <ul className="mt-4 space-y-2.5">
          {(["ruleCount", "ruleRecord", "ruleNav", "ruleEnv"] as const).map((k) => (
            <li key={k} className="flex gap-2.5 text-[13.5px] leading-[1.8] text-[#3d4763]">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#35a07a]" aria-hidden="true" />
              <span>{k === "ruleCount" ? t(k, { n: questions.length }) : t(k)}</span>
            </li>
          ))}
        </ul>

        {/* 題目結構：共幾個系列、每個系列幾題 */}
        {sections.length > 0 && (
          <div className="mt-5 rounded-xl border border-[#e6e9f2] px-4 py-4">
            <p className="text-[13px] font-bold text-[#161b2e]">
              {t("sectionsTitle", { s: sections.length, n: questions.length })}
            </p>
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {sections.map((s, i) => (
                <li
                  key={s.key}
                  className="flex items-center justify-between gap-3 text-[12.5px] leading-[1.6] text-[#5d6b85]"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[#e9f5f0] text-[10px] font-bold text-[#2a8163]">
                      {i + 1}
                    </span>
                    {sectionName(s.key)}
                  </span>
                  <span className="shrink-0 font-mono text-[11.5px] text-[#8b95ad]">
                    {t("sectionCount", { n: s.count })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-4 rounded-xl bg-[#f4f6fb] px-4 py-3 text-[12.5px] leading-[1.8] text-[#5d6b85]">
          {t("privacy")}
        </p>
        <button type="button" onClick={() => setPhase({ name: "setup" })} className={`${BTN_PRIMARY} mt-6`}>
          {t("agreeStart")}
        </button>
      </>
    );
  } else if (phase.name === "setup") {
    body = (
      <>
        <LangSelector lang={lang} onChange={setLang} label={t("langLabel")} />
        <h1 className="text-[20px] font-bold text-[#161b2e]">{t("setupTitle")}</h1>
        <p className="mt-2 text-[13.5px] leading-[1.8] text-[#5d6b85]">{t("setupDesc")}</p>

        {/* 鏡頭預覽 */}
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-[#e6e9f2] bg-black">
          <video ref={setupVideoRef} playsInline muted className="aspect-video w-full object-cover" />
          {setupState !== "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#161b2e]/85 px-6 text-center">
              {setupState === "asking" ? (
                <>
                  <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
                  <p className="text-[13px] leading-[1.7] text-white/85">{t("setupRequesting")}</p>
                </>
              ) : (
                <>
                  <Video size={28} className="text-white/70" aria-hidden="true" />
                  <p className="text-[13px] leading-[1.8] text-white/85">{t("setupDenied")}</p>
                  <button type="button" onClick={requestDevices} className={`${BTN_OUTLINE} !py-2 text-[13px]`}>
                    {t("setupRetry")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 咪高峰測試：實時音量條 + 3 秒試錄回放 */}
        {setupState === "ready" && (
          <div className="mt-4 rounded-2xl border border-[#e6e9f2] bg-[#f8f9fc] p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#3d4763]">
              <Mic size={15} className="text-[#35a07a]" aria-hidden="true" />
              {t("micTestTitle")}
            </div>
            <p className="mt-1.5 text-[12.5px] leading-[1.7] text-[#5d6b85]">{t("micTestHint")}</p>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#e6e9f2]">
              <div
                className={`h-full rounded-full transition-[width] duration-75 ${micLevel > 0.5 ? "bg-[#35a07a]" : "bg-[#8fd3b8]"}`}
                style={{ width: `${Math.round(micLevel * 100)}%` }}
              />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={micTest}
                className={`${BTN_OUTLINE} !py-2 text-[13px]`}
                disabled={micTestState === "recording" || micTestState === "playing"}
              >
                {micTestState === "recording"
                  ? t("micRecording")
                  : micTestState === "playing"
                    ? t("micPlaying")
                    : micTestUrl
                      ? t("micPlay")
                      : t("micRecord")}
              </button>
              {micTestState === "recording" && (
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#d64545]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#d64545]" aria-hidden="true" />
                  {t("micRecordingHint")}
                </span>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={startSession}
          disabled={setupState !== "ready"}
          className={`${BTN_PRIMARY} mt-6`}
        >
          {t("setupStart")}
        </button>
      </>
    );
  } else if (phase.name === "processing") {
    const isUpload = phase.step === "upload";
    body = (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#e9f5f0] border-t-[#35a07a]" />
        <h2 className="text-[17px] font-bold text-[#161b2e]">
          {isUpload ? t("stepUpload") : t("stepAnalyze")}
        </h2>
        <div className="w-full max-w-[420px] space-y-3">
          <div>
            <div className="mb-1.5 flex justify-between text-[12px] font-semibold">
              <span className={isUpload ? "text-[#2a8163]" : "text-[#161b2e]"}>{t("stepUpload")}</span>
              <span className="text-[#8b95ad]">{isUpload ? `${phase.pct}%` : "100%"}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#e6e9f2]">
              <div
                className="h-full rounded-full bg-[#35a07a] transition-[width] duration-300"
                style={{ width: `${isUpload ? phase.pct : 100}%` }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-[12px] font-semibold">
              <span className={!isUpload ? "text-[#2a8163]" : "text-[#8b95ad]"}>{t("stepAnalyze")}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#e6e9f2]">
              <div className={`h-full rounded-full bg-[#35a07a] ${isUpload ? "w-0" : "w-full animate-pulse"}`} />
            </div>
          </div>
        </div>
        <p className="max-w-[40ch] text-[12.5px] leading-[1.8] text-[#8b95ad]">{t("analyzingHint")}</p>
      </div>
    );
  } else {
    // phase.name === "question"：全程錄製中的作答頁
    body = (
      <>
        <LangSelector lang={lang} onChange={setLang} label={t("langLabel")} />
        {/* 錄製狀態：畫中畫預覽（鏡頭全程開著）+ 進度 + 咪高峰實時音量 */}
        <div className="mb-5 flex items-center gap-3">
          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-[#e6e9f2] bg-black">
            <video ref={liveVideoRef} playsInline muted className="h-full w-full object-cover" />
            <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff4d4d]" aria-hidden="true" />
              {t("recOn")}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-[#8b95ad]">
              {t("progressOf", { x: qIndex + 1, n: questions.length })}
            </div>
            <div className="mt-2 flex gap-1.5">
              {questions.map((q, i) => (
                <span
                  key={q.id}
                  aria-hidden="true"
                  className={`h-1.5 flex-1 rounded-full ${i <= qIndex ? "bg-[#35a07a]" : "bg-[#e6e9f2]"}`}
                />
              ))}
            </div>
            {/* 咪高峰實時音量（作答全程可見，隨時確認收音正常） */}
            <div className="mt-2 flex items-center gap-1.5">
              <Mic size={12} className="shrink-0 text-[#35a07a]" aria-hidden="true" />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e6e9f2]">
                <div
                  className={`h-full rounded-full transition-[width] duration-75 ${micLevel > 0.5 ? "bg-[#35a07a]" : "bg-[#8fd3b8]"}`}
                  style={{ width: `${Math.round(micLevel * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 當前所屬系列 */}
        {currentSectionIdx > 0 && (
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e9f5f0] px-3 py-1 text-[11.5px] font-bold text-[#2a8163]">
              {t("sectionOf", {
                x: currentSectionIdx,
                s: sections.length,
                name: sectionName(currentQ?.category || "custom"),
              })}
            </span>
          </div>
        )}

        {/* 題目卡 */}
        {currentQ && (
          <div className="rounded-2xl border border-[#e6e9f2] bg-[#f8f9fc] p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[16px] font-semibold leading-[1.7] text-[#161b2e]">
                {currentQ.translations?.[lang] || currentQ.question}
              </p>
              <button
                type="button"
                onClick={() => playQuestion(currentQ)}
                disabled={playing}
                aria-label={t("replayQuestion")}
                className="shrink-0 cursor-pointer rounded-full border border-[#e6e9f2] bg-white p-2 text-[#35a07a] transition-colors hover:border-[#35a07a]/50 disabled:opacity-50"
              >
                <Volume2 size={17} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-[12.5px] leading-[1.7] text-[#8b95ad]">{t("answerHint")}</p>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-[#f2caca] bg-[#fdf0f0] px-4 py-3 text-[13px] leading-[1.7] text-[#b03a3a]">
            {error}
          </p>
        )}

        {/* 未作答確認提示 */}
        {confirmFinish && unansweredCount > 0 && (
          <p className="mt-4 rounded-xl border border-[#f0d79a] bg-[#fdf6e3] px-4 py-3 text-[13px] leading-[1.7] text-[#8a6d1a]">
            {t("unansweredWarn", { n: unansweredCount })}
          </p>
        )}

        {/* 導航：自由上一題 / 下一題；最後一題提交整場 */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => gotoQuestion(qIndex - 1)}
            disabled={qIndex === 0 || busy}
            className={`${BTN_OUTLINE} flex-1`}
          >
            {t("prevQuestion")}
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={() => {
                if (unansweredCount > 0 && !confirmFinish) {
                  setConfirmFinish(true);
                  return;
                }
                void submitSession();
              }}
              disabled={busy}
              className={`${BTN_PRIMARY} flex-1`}
            >
              <Send size={15} aria-hidden="true" />
              {confirmFinish && unansweredCount > 0 ? t("confirmFinish") : t("finishNow")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => gotoQuestion(qIndex + 1)}
              disabled={busy}
              className={`${BTN_PRIMARY} flex-1`}
            >
              {t("nextQuestion")}
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <Shell lang={lang} footerText={t("footer")}>
      {body}
    </Shell>
  );
}
