"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleCheck,
  ImagePlus,
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
import { sectionLabel, CORE70_QUESTIONS, EMPLOYER_LOOP_TEMPLATE, fillEmployerIndex } from "@/lib/interview/shared-questions";

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
  status: "pending" | "in_progress" | "processing" | "completed";
  /** continuous=整段錄製（Basic）；per-question=實時逐題（Advanced v2） */
  mode?: "continuous" | "per-question";
  questions: Question[];
  progress: Record<string, { attempts: number; passed: boolean }>;
}

/** 實時逐題模式嘅運行時題目項（雇主迴圈按答案動態展開） */
interface PerqItem {
  /** 運行時唯一 key（迴圈實例帶 -eN 後綴） */
  key: string;
  /** 共享題目 id（TTS 音頻複用 + DB question_id） */
  qid: string;
  /** 展示/落庫用題目文字（已替換 [k] 並帶僱主#k 前綴） */
  display: string;
  /** 五語譯文（同替換規則） */
  displayTrans: Record<string, string>;
  category: string | null;
  /** 雇主迴圈 = 第幾位僱主（1-4）；普通題 = 1 */
  attempt: number;
  /** 雇主迴圈徽標文案 */
  employerLabel?: string;
}

/** 逐題模式常量（唔 import store.ts：避免 service key 打入客戶端 bundle） */
const PERQ_MAX_EMPLOYERS = 4;
const PERQ_MAX_SECONDS = 90;
const EMPLOYER_COUNT_TEXT =
  CORE70_QUESTIONS.find((q) => q.section === "adv-employer")?.question || "";

const PHOTO_SLOTS = ["dish-1", "dish-2", "dish-3", "work-1", "work-2"] as const;
type PhotoSlot = (typeof PHOTO_SLOTS)[number];

interface PhotoEntry {
  path: string;
  preview: string;
  label: string;
  uploading: boolean;
}

type Phase =
  | { name: "loading" }
  | { name: "error"; message: string }
  | { name: "consent" }
  | { name: "setup" }
  | { name: "question" }
  | { name: "perq" }
  | { name: "employerCount" }
  | { name: "photos" }
  | { name: "processing"; step: "upload" | "submit"; pct: number }
  | { name: "submitted" }
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

  // 實時逐題（per-question）相關
  const [perqList, setPerqList] = useState<PerqItem[]>([]);
  const [perqIndex, setPerqIndex] = useState(0);
  const [employerCount, setEmployerCount] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [savingPerq, setSavingPerq] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [photoState, setPhotoState] = useState<Record<string, PhotoEntry>>({});
  const perqBusyRef = useRef(false);
  const perqTimerRef = useRef(0);
  const perqAutoStopRef = useRef(0);

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

  const questions = useMemo(() => info?.questions ?? [], [info]);
  const currentQ: Question | null = questions[qIndex] ?? null;
  const isLast = qIndex >= questions.length - 1;
  const unansweredCount = questions.length - visitedIds.length;
  const isPerq = info?.mode === "per-question";
  const questionsById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const currentPerq: PerqItem | null = perqList[perqIndex] ?? null;
  const currentPerqBase: Question | null = currentPerq
    ? questionsById.get(currentPerq.qid) ?? null
    : null;

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

  /** 首次/重新載入：按狀態決定階段（processing = 已提交，AI 後台解析中） */
  const load = useCallback(async () => {
    const data = await fetchInfo();
    if (!data) return;
    setPhase(
      data.status === "completed"
        ? { name: "finished" }
        : data.status === "processing"
          ? { name: "submitted" }
          : { name: "consent" }
    );
  }, [fetchInfo]);

  const stopStream = () => {
    recorderRef.current = null;
    clearTimeout(perqAutoStopRef.current);
    clearInterval(perqTimerRef.current);
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

  // 進入新題目 / 切換語言時自動播放題目（連續模式 question 或逐題模式 perq；延後到宏任務）
  useEffect(() => {
    const isContinuous = phase.name === "question";
    const isPerqPhase = phase.name === "perq";
    if (!isContinuous && !isPerqPhase) return;
    const q = isPerqPhase ? currentPerqBase : currentQ;
    if (!q) return;
    const id = setTimeout(() => playQuestion(q), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅按題目 id / 語言 / 階段觸發，避免對象引用變化重播
  }, [currentQ?.id, currentPerq?.key, lang, phase.name]);

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
    if (
      (phase.name === "question" || phase.name === "perq" || phase.name === "photos") &&
      streamRef.current
    ) {
      attachStream(streamRef.current);
    }
  }, [phase.name]);

  // 上傳堵頁：processing（上傳 + 提交）期間攔截關閉/刷新/返回；提交完成後自動解除
  useEffect(() => {
    if (phase.name !== "processing") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
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
  /** 記錄到訪題目與切題時間線（後端按此切段音頻：每次切題都記，含翻題重答） */
  const markVisit = (q: Question) => {
    setVisitedIds((prev) => (prev.includes(q.id) ? prev : [...prev, q.id]));
    eventsRef.current.push({
      questionId: q.id,
      at: Math.round((Date.now() - recordStartRef.current) / 1000),
    });
  };

  const startSession = () => {
    const stream = streamRef.current;
    if (!stream || questions.length === 0) return;
    // 實時逐題模式（Advanced v2）：唔開始連續錄製，逐題錄一題傳一題
    if (isPerq) {
      setPerqList(buildPerqList(null));
      setPerqIndex(0);
      setEmployerCount(null);
      setPhase({ name: "perq" });
      return;
    }
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

  // ---------- 實時逐題模式（per-question，Advanced v2） ----------
  /** 構建逐題運行時題單；employerCount 為 null 時未答前僱主數量（未展開迴圈） */
  const buildPerqList = (count: number | null): PerqItem[] => {
    const items: PerqItem[] = questions.map((q) => ({
      key: q.id,
      qid: q.id,
      display: q.question,
      displayTrans: q.translations || {},
      category: q.category || null,
      attempt: 1,
    }));
    if (count === null) return items;
    const countIdx = items.findIndex((it) => it.display === EMPLOYER_COUNT_TEXT);
    if (countIdx < 0 || count <= 0) return items; // N=0：跳過前僱主章節後續問題
    // 展開迴圈：每位僱主 6 題（Q29–34 模板替換 [k]，TTS 音頻複用模板題）
    const loopItems: PerqItem[] = [];
    for (let k = 1; k <= count; k++) {
      for (const tpl of EMPLOYER_LOOP_TEMPLATE) {
        const base = questions.find((q) => q.question === tpl.question);
        if (!base) continue;
        const prefix = `${t("employerBadge", { k })} — `;
        loopItems.push({
          key: `${base.id}-e${k}`,
          qid: base.id,
          display: prefix + fillEmployerIndex(base.question, k),
          displayTrans: Object.fromEntries(
            Object.entries(base.translations || {}).map(([l, text]) => [
              l,
              prefix + fillEmployerIndex(text, k),
            ])
          ),
          category: base.category || null,
          attempt: k,
          employerLabel: t("employerBadge", { k }),
        });
      }
    }
    return [...items.slice(0, countIdx + 1), ...loopItems, ...items.slice(countIdx + 1)];
  };

  /** 選定前僱主數量後重建題單並跳到迴圈第一題 */
  const pickEmployerCount = (n: number) => {
    const list = buildPerqList(n);
    setEmployerCount(n);
    setPerqList(list);
    const countIdx = list.findIndex((it) => it.display === EMPLOYER_COUNT_TEXT);
    setPerqIndex(countIdx >= 0 ? countIdx + 1 : 0);
    setPhase({ name: "perq" });
  };

  /** 逐題模式：開始錄製本題回答 */
  const perqStartRecording = () => {
    const stream = streamRef.current;
    if (!stream || perqBusyRef.current || recording) return;
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
    setRecording(true);
    setError("");
    setRecSec(0);
    perqTimerRef.current = window.setInterval(() => setRecSec((s) => s + 1), 1000);
    perqAutoStopRef.current = window.setTimeout(() => void perqStopAndSubmit(), PERQ_MAX_SECONDS * 1000);
  };

  /** 逐題模式：停止錄製 → 上傳視頻 + 音頻 → 提交該題作答 → 前進 */
  const perqStopAndSubmit = async () => {
    if (perqBusyRef.current) return;
    const item = perqList[perqIndex];
    if (!item) return;
    perqBusyRef.current = true;
    clearTimeout(perqAutoStopRef.current);
    clearInterval(perqTimerRef.current);
    try {
      const blob = await stopSessionRecording();
      if (!blob || blob.size === 0) throw new Error("錄製失敗，請再試一次");
      setRecording(false);
      setSavingPerq(true);

      // 1) 該題視頻簽名上傳 + 直傳
      const urlRes = await fetch(`/api/interview/${token}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "question",
          questionId: item.qid,
          attempt: item.attempt,
          size: blob.size,
          contentType: blob.type || "video/webm",
        }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error || "上傳初始化失敗");
      await uploadWithProgress(urlData.signedUrl, blob, () => {});

      // 2) 提取純音頻（16kHz mono WAV）並上傳（盡力而為：STT 優先吃 WAV）
      let audioPath: string | undefined;
      try {
        const wav = await blobToWav(blob);
        const audioUrlRes = await fetch(`/api/interview/${token}/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "question",
            questionId: item.qid,
            attempt: item.attempt,
            size: wav.size,
            contentType: "audio/wav",
          }),
        });
        if (audioUrlRes.ok) {
          const audioUrlData = await audioUrlRes.json();
          await uploadWithProgress(audioUrlData.signedUrl, wav, () => {});
          audioPath = audioUrlData.path;
        }
      } catch {
        /* 冇音頻都照提交（服務端回落視頻轉寫鏈） */
      }

      // 3) 提交該題作答（服務端轉寫並落庫）
      const res = await fetch(`/api/interview/${token}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: item.qid,
          questionText: item.display,
          videoPath: urlData.path,
          audioPath,
          attempt: item.attempt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "提交失敗，請重試");

      setSavingPerq(false);
      setError("");
      // 前進：前僱主數量題 → 選擇數量步驟；最後一題 → 照片上傳；否則下一題
      if (item.display === EMPLOYER_COUNT_TEXT && employerCount === null) {
        setPhase({ name: "employerCount" });
        return;
      }
      if (perqIndex >= perqList.length - 1) {
        setPhase({ name: "photos" });
        return;
      }
      setPerqIndex(perqIndex + 1);
    } catch (e) {
      setSavingPerq(false);
      setRecording(false);
      setError(e instanceof Error ? e.message : "提交失敗，請重試");
    } finally {
      perqBusyRef.current = false;
    }
  };

  // ---------- 作品照片上傳（per-question 面試結束後） ----------
  const uploadPhoto = async (slot: PhotoSlot, file: File) => {
    setError("");
    setPhotoState((s) => ({ ...s, [slot]: { ...s[slot], uploading: true } }));
    try {
      const urlRes = await fetch(`/api/interview/${token}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "photo", photoKey: slot, size: file.size, contentType: file.type }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error || "上傳初始化失敗");
      await uploadWithProgress(urlData.signedUrl, file, () => {});
      const preview = URL.createObjectURL(file);
      setPhotoState((s) => ({
        ...s,
        [slot]: { path: urlData.path, preview, label: s[slot]?.label || "", uploading: false },
      }));
    } catch (e) {
      setPhotoState((s) => ({ ...s, [slot]: { ...s[slot], uploading: false } }));
      setError(e instanceof Error ? e.message : "照片上傳失敗，請重試");
    }
  };

  /** 逐題模式最終提交：附上作品照片 → 觸發報告/CV 後台任務 */
  const submitPerqSession = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const photos = PHOTO_SLOTS.filter((sl) => photoState[sl]?.path).map((sl) => ({
        kind: sl.startsWith("dish") ? "dish" : "work",
        label: photoState[sl].label || "",
        path: photoState[sl].path,
      }));
      setPhase({ name: "processing", step: "submit", pct: 100 });
      const res = await fetch(`/api/interview/${token}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "per-question", photos }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "提交失敗");
      stopStream();
      setPhase({ name: "submitted" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失敗，請稍後再試");
      setPhase({ name: "photos" });
    } finally {
      setBusy(false);
    }
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

      // 3) 提交後台任務（秒回）：AI 轉寫切分 + 報告改喺後台慢慢跑，唔使喺頁面等
      setPhase({ name: "processing", step: "submit", pct: 100 });
      const res = await fetch(`/api/interview/${token}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath: urlData.path, audioPath, events: eventsRef.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "提交失敗");
      if (data.warning) setWarning(data.warning);
      stopStream();
      // 已提交：AI 後台解析中，用戶可以即刻閂頁
      setPhase({ name: "submitted" });
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
          {(
            isPerq
              ? (["ruleCount", "perqRule", "ruleEnv"] as const)
              : (["ruleCount", "ruleRecord", "ruleNav", "ruleEnv"] as const)
          ).map((k) => (
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

        {/* 鏡頭預覽（豎屏取景：99% 用戶手機錄製） */}
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-[#e6e9f2] bg-black">
          <video ref={setupVideoRef} playsInline muted className="aspect-[3/4] max-h-[44vh] w-full object-cover" />
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
          {isUpload ? t("stepUpload") : t("stepSubmit")}
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
              <span className={!isUpload ? "text-[#2a8163]" : "text-[#8b95ad]"}>{t("stepSubmit")}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#e6e9f2]">
              <div className={`h-full rounded-full bg-[#35a07a] ${isUpload ? "w-0" : "w-full animate-pulse"}`} />
            </div>
          </div>
        </div>
        {/* 堵頁提示：上傳未完唔可以閂頁；解析喺後台，唔使等 */}
        <p className="max-w-[46ch] rounded-xl border border-[#f0d79a] bg-[#fdf6e3] px-4 py-3 text-[13px] font-semibold leading-[1.8] text-[#8a6d1a]">
          {t("uploadBlockHint")}
        </p>
      </div>
    );
  } else if (phase.name === "submitted") {
    // 已提交：AI 後台解析中，可以即刻閂頁；之後重開連結可睇狀態
    body = (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CircleCheck size={44} className="text-[#35a07a]" aria-hidden="true" />
        <h1 className="text-[20px] font-bold text-[#161b2e]">{t("submitted")}</h1>
        <p className="max-w-[44ch] text-[14px] leading-[1.9] text-[#3d4763]">{t("submittedDesc")}</p>
        {warning && (
          <p className="max-w-[46ch] rounded-xl border border-[#f0d79a] bg-[#fdf6e3] px-4 py-3 text-left text-[12.5px] leading-[1.7] text-[#8a6d1a]">
            {warning}
          </p>
        )}
        <button type="button" onClick={() => void load()} className={BTN_OUTLINE}>
          {t("submittedRefresh")}
        </button>
      </div>
    );
  } else if (phase.name === "perq") {
    // 實時逐題：錄一題傳一題，唔可以返回上一題
    body = (
      <>
        <LangSelector lang={lang} onChange={setLang} label={t("langLabel")} />
        {/* 大畫面預覽（錄製中顯示 REC 徽標） */}
        <div className="relative mb-4 overflow-hidden rounded-2xl border border-[#e6e9f2] bg-black">
          <video ref={liveVideoRef} playsInline muted className="aspect-[3/4] max-h-[40vh] w-full object-cover" />
          {recording && (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff4d4d]" aria-hidden="true" />
              {t("recOn")} {recSec}s
            </span>
          )}
        </div>

        {/* 進度 */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[12px] font-semibold text-[#8b95ad]">
            <span>{t("progressOf", { x: perqIndex + 1, n: perqList.length })}</span>
            <span className="flex items-center gap-1.5" aria-label={t("micTestTitle")}>
              <Mic size={12} className="text-[#35a07a]" aria-hidden="true" />
              <span className="inline-block h-1.5 w-20 overflow-hidden rounded-full bg-[#e6e9f2]">
                <span
                  className={`block h-full rounded-full transition-[width] duration-75 ${micLevel > 0.5 ? "bg-[#35a07a]" : "bg-[#8fd3b8]"}`}
                  style={{ width: `${Math.round(micLevel * 100)}%` }}
                />
              </span>
            </span>
          </div>
          <div className="mt-1.5 flex gap-1">
            {perqList.map((q, i) => (
              <span
                key={q.key}
                aria-hidden="true"
                className={`h-1 flex-1 rounded-full ${i <= perqIndex ? "bg-[#35a07a]" : "bg-[#e6e9f2]"}`}
              />
            ))}
          </div>
        </div>

        {/* 當前所屬系列 / 僱主徽標 */}
        {currentPerq && (
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e9f5f0] px-3 py-1 text-[11.5px] font-bold text-[#2a8163]">
              {currentPerq.employerLabel || sectionName(currentPerq.category || "custom")}
            </span>
          </div>
        )}

        {/* 題目卡 */}
        {currentPerq && (
          <div className="rounded-2xl border border-[#e6e9f2] bg-[#f8f9fc] p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[16px] font-semibold leading-[1.7] text-[#161b2e]">
                {currentPerq.displayTrans?.[lang] || currentPerq.display}
              </p>
              <button
                type="button"
                onClick={() => currentPerqBase && playQuestion(currentPerqBase)}
                disabled={playing}
                aria-label={t("replayQuestion")}
                className="shrink-0 cursor-pointer rounded-full border border-[#e6e9f2] bg-white p-2 text-[#35a07a] transition-colors hover:border-[#35a07a]/50 disabled:opacity-50"
              >
                <Volume2 size={17} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-[12.5px] leading-[1.7] text-[#8b95ad]">
              {t("answerHintPerq")}
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-[#f2caca] bg-[#fdf0f0] px-4 py-3 text-[13px] leading-[1.7] text-[#b03a3a]">
            {error}
          </p>
        )}

        {/* 錄製 / 提交控制 */}
        <div className="mt-6">
          {savingPerq ? (
            <div className="flex items-center justify-center gap-2 rounded-full bg-[#f4f6fb] px-6 py-3 text-[14px] font-semibold text-[#5d6b85]">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#e9f5f0] border-t-[#35a07a]" />
              {t("perqSaving")}
            </div>
          ) : recording ? (
            <button type="button" onClick={() => void perqStopAndSubmit()} className={BTN_PRIMARY}>
              <Send size={15} aria-hidden="true" />
              {t("stopSubmit")}
            </button>
          ) : (
            <button type="button" onClick={perqStartRecording} className={BTN_PRIMARY}>
              <Video size={16} aria-hidden="true" />
              {t("startAnswer")}
            </button>
          )}
        </div>
      </>
    );
  } else if (phase.name === "employerCount") {
    // 前僱主迴圈：確認前僱主總數（甲方劇本 Q28 規則：0 跳過 / 1–4 逐位追問）
    body = (
      <>
        <LangSelector lang={lang} onChange={setLang} label={t("langLabel")} />
        <h1 className="text-[19px] font-bold text-[#161b2e]">{t("employerCountTitle")}</h1>
        <p className="mt-3 text-[13.5px] leading-[1.8] text-[#5d6b85]">{t("employerCountHint")}</p>
        <div className="mt-6 grid grid-cols-5 gap-2">
          {Array.from({ length: PERQ_MAX_EMPLOYERS + 1 }, (_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => pickEmployerCount(n)}
              className="cursor-pointer rounded-2xl border border-[#e6e9f2] bg-white py-4 text-[18px] font-bold text-[#3d4763] transition-colors hover:border-[#35a07a]/50 hover:bg-[#e9f5f0] hover:text-[#2a8163]"
            >
              {n}
            </button>
          ))}
        </div>
      </>
    );
  } else if (phase.name === "photos") {
    // 面試後作品照片：2–3 張煮菜照 + 1–2 張工作照（可跳過）
    const groups: { title: string; slots: PhotoSlot[] }[] = [
      { title: t("dishPhotos"), slots: ["dish-1", "dish-2", "dish-3"] },
      { title: t("workPhotos"), slots: ["work-1", "work-2"] },
    ];
    body = (
      <>
        <LangSelector lang={lang} onChange={setLang} label={t("langLabel")} />
        <h1 className="text-[19px] font-bold text-[#161b2e]">{t("photosTitle")}</h1>
        <p className="mt-3 text-[13.5px] leading-[1.8] text-[#5d6b85]">{t("photosDesc")}</p>
        {groups.map((g) => (
          <div key={g.title} className="mt-5">
            <p className="text-[13px] font-bold text-[#161b2e]">{g.title}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {g.slots.map((slot) => {
                const entry = photoState[slot];
                return entry?.path ? (
                  <div key={slot} className="flex flex-col gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.preview}
                      alt={entry.label || slot}
                      className="h-24 w-full rounded-xl border border-[#e6e9f2] object-cover"
                    />
                    <input
                      type="text"
                      value={entry.label}
                      maxLength={60}
                      placeholder={t("photoLabelPlaceholder")}
                      onChange={(e) =>
                        setPhotoState((s) => ({
                          ...s,
                          [slot]: { ...s[slot], label: e.target.value },
                        }))
                      }
                      className="w-full rounded-lg border border-[#e6e9f2] px-2 py-1.5 text-[11.5px] text-[#3d4763] outline-none focus:border-[#35a07a]/50"
                    />
                  </div>
                ) : (
                  <label
                    key={slot}
                    className={`flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#c8cfdd] bg-[#f8f9fc] text-[11.5px] font-semibold text-[#8b95ad] transition-colors hover:border-[#35a07a]/50 hover:text-[#2a8163] ${entry?.uploading ? "pointer-events-none opacity-60" : ""}`}
                  >
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      className="hidden"
                      disabled={entry?.uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadPhoto(slot, f);
                        e.target.value = "";
                      }}
                    />
                    {entry?.uploading ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#e9f5f0] border-t-[#35a07a]" />
                        {t("photoUploading")}
                      </span>
                    ) : (
                      <>
                        <ImagePlus size={18} aria-hidden="true" />
                        {t("addPhoto")}
                      </>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        {error && (
          <p className="mt-4 rounded-xl border border-[#f2caca] bg-[#fdf0f0] px-4 py-3 text-[13px] leading-[1.7] text-[#b03a3a]">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2.5">
          <button type="button" onClick={() => void submitPerqSession()} disabled={busy} className={BTN_PRIMARY}>
            <Send size={15} aria-hidden="true" />
            {t("submitFinal")}
          </button>
          <button type="button" onClick={() => void submitPerqSession()} disabled={busy} className={BTN_OUTLINE}>
            {t("skipPhotos")}
          </button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <LangSelector lang={lang} onChange={setLang} label={t("langLabel")} />
        {/* 大畫面預覽（豎屏手機錄製為主：3:4 全寬大圖，鏡頭全程開著） */}
        <div className="relative mb-4 overflow-hidden rounded-2xl border border-[#e6e9f2] bg-black">
          <video ref={liveVideoRef} playsInline muted className="aspect-[3/4] max-h-[46vh] w-full object-cover" />
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff4d4d]" aria-hidden="true" />
            {t("recOn")}
          </span>
        </div>

        {/* 進度 + 咪高峰實時音量（緊湊一行，作答全程可見） */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[12px] font-semibold text-[#8b95ad]">
            <span>{t("progressOf", { x: qIndex + 1, n: questions.length })}</span>
            <span className="flex items-center gap-1.5" aria-label={t("micTestTitle")}>
              <Mic size={12} className="text-[#35a07a]" aria-hidden="true" />
              <span className="inline-block h-1.5 w-20 overflow-hidden rounded-full bg-[#e6e9f2]">
                <span
                  className={`block h-full rounded-full transition-[width] duration-75 ${micLevel > 0.5 ? "bg-[#35a07a]" : "bg-[#8fd3b8]"}`}
                  style={{ width: `${Math.round(micLevel * 100)}%` }}
                />
              </span>
            </span>
          </div>
          <div className="mt-1.5 flex gap-1">
            {questions.map((q, i) => (
              <span
                key={q.id}
                aria-hidden="true"
                className={`h-1 flex-1 rounded-full ${i <= qIndex ? "bg-[#35a07a]" : "bg-[#e6e9f2]"}`}
              />
            ))}
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
