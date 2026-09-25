/**
 * 面試多語言支持（前後端共用）：
 * 5 種語言 — 英語 / 印尼語 / 菲律賓語 / 粵語 / 普通話
 * - ttsCode：Gemini TTS languageCode
 * - bcp47：瀏覽器 SpeechSynthesis 降級時用
 */

export type LocaleKey = "en" | "id" | "tl" | "zh";

export interface LocaleDef {
  key: LocaleKey;
  label: string;
  /** Gemini TTS languageCode；空字串 = 該 TTS 模型不支持（降級瀏覽器語音合成） */
  ttsCode: string;
  bcp47: string;
  voice: string;
}

export const LOCALES: LocaleDef[] = [
  { key: "en", label: "English", ttsCode: "en-US", bcp47: "en-US", voice: "Kore" },
  { key: "id", label: "Indonesia", ttsCode: "id-ID", bcp47: "id-ID", voice: "Kore" },
  { key: "tl", label: "Filipino", ttsCode: "fil-PH", bcp47: "fil-PH", voice: "Kore" },
  { key: "zh", label: "普通话", ttsCode: "cmn-CN", bcp47: "zh-CN", voice: "Kore" },
];

export const DEFAULT_LOCALE: LocaleKey = "en";

export function isLocale(v: unknown): v is LocaleKey {
  return typeof v === "string" && LOCALES.some((l) => l.key === v);
}

/** 簡單佔位符替換：{n} / {max} / {name} */
export function tstr(template: string, vars: Record<string, string | number> = {}): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

/** 工人端面試頁 UI 文案（5 語） */
export const UI_STRINGS: Record<LocaleKey, Record<string, string>> = {
  en: {
    loading: "Loading…",
    reload: "Reload",
    footer: "Powered by NEXUSLINK",
    title: "Video Interview",
    hello: "Hello, {name}",
    welcome: "Welcome to this video interview. Please read the following before you start.",
    ruleCount: "There are {n} questions. Answer each one out loud in English, Bahasa Indonesia, Filipino or Mandarin.",
    ruleSeconds: "Maximum {max} seconds per answer. You may re-record as many times as you like before submitting.",
    ruleAi: "Each answer is analysed by AI immediately. You move on only after passing.",
    ruleEnv: "Find a quiet, well-lit place and allow camera & microphone access.",
    privacy: "Privacy: your recordings are used only for this recruitment assessment and handled in accordance with the Personal Data (Privacy) Ordinance.",
    agreeStart: "Agree & Start",
    finished: "Interview Completed",
    finishedDesc: "Thank you for completing the video interview, {name}. We will notify you of the result soon.",
    finishedClose: "You may close this page now.",
    allDone: "All questions completed",
    allDoneDesc: "Press the button below to submit your interview. An overall assessment report will be generated.",
    finishSubmit: "Finish & Submit Interview",
    submitting: "Submitting…",
    progressOf: "Question {x} / {n}",
    attemptsLeft: "{n} attempts left for this question",
    analyzing: "Analysing your answer…",
    analyzingHint: "About 10 seconds. Please keep this page open.",
    stepUpload: "Uploading video",
    stepAnalyze: "AI analysing your answer",
    startRecord: "Start Recording",
    recordHint: "When ready, press the button and speak to the camera.",
    recordingLeft: "Recording… {s}s left",
    doneAnswer: "Finish Answer",
    retake: "Re-record",
    submitAnswer: "Submit Answer",
    uploading: "Uploading…",
    playQuestion: "Play question",
    replayQuestion: "Replay",
    langLabel: "Language",
    errCamera: "Cannot access camera/microphone. Please check browser permissions and try again.",
  },
  id: {
    loading: "Memuat…",
    reload: "Muat Ulang",
    footer: "Didukung oleh NEXUSLINK",
    title: "Wawancara Video",
    hello: "Halo, {name}",
    welcome: "Selamat datang di wawancara video ini. Silakan baca hal berikut sebelum memulai.",
    ruleCount: "Ada {n} pertanyaan. Jawab setiap pertanyaan dengan suara dalam Bahasa Indonesia, Inggris, Filipino atau Mandarin.",
    ruleSeconds: "Maksimal {max} detik per jawaban. Anda dapat merekam ulang sebanyak yang diperlukan sebelum mengirim.",
    ruleAi: "Setiap jawaban langsung dianalisis oleh AI. Anda hanya bisa lanjut setelah lulus.",
    ruleEnv: "Pilih tempat yang tenang dan terang, lalu izinkan akses kamera & mikrofon.",
    privacy: "Privasi: rekaman Anda hanya digunakan untuk penilaian rekrutmen ini dan ditangani sesuai peraturan perlindungan data pribadi.",
    agreeStart: "Setuju & Mulai",
    finished: "Wawancara Selesai",
    finishedDesc: "Terima kasih telah menyelesaikan wawancara video, {name}. Kami akan segera memberi tahu hasilnya.",
    finishedClose: "Anda boleh menutup halaman ini sekarang.",
    allDone: "Semua pertanyaan selesai",
    allDoneDesc: "Tekan tombol di bawah untuk mengirim wawancara. Laporan penilaian keseluruhan akan dibuat.",
    finishSubmit: "Selesai & Kirim Wawancara",
    submitting: "Mengirim…",
    progressOf: "Pertanyaan {x} / {n}",
    attemptsLeft: "Sisa {n} kesempatan untuk pertanyaan ini",
    analyzing: "Menganalisis jawaban Anda…",
    analyzingHint: "Sekitar 10 detik. Jangan tutup halaman ini.",
    stepUpload: "Mengunggah video",
    stepAnalyze: "AI menganalisis jawaban Anda",
    startRecord: "Mulai Merekam",
    recordHint: "Jika sudah siap, tekan tombol dan jawab menghadap kamera.",
    recordingLeft: "Merekam… sisa {s} detik",
    doneAnswer: "Selesai Menjawab",
    retake: "Rekam Ulang",
    submitAnswer: "Kirim Jawaban",
    uploading: "Mengunggah…",
    playQuestion: "Putar pertanyaan",
    replayQuestion: "Putar ulang",
    langLabel: "Bahasa",
    errCamera: "Tidak dapat mengakses kamera/mikrofon. Periksa izin browser lalu coba lagi.",
  },
  tl: {
    loading: "Naglo-load…",
    reload: "I-load Muli",
    footer: "Pinapagana ng NEXUSLINK",
    title: "Video Interview",
    hello: "Kumusta, {name}",
    welcome: "Maligayang pagdating sa video interview na ito. Basahin muna ang mga sumusunod bago magsimula.",
    ruleCount: "May {n} na tanong. Sagutin nang malakas ang bawat isa sa Filipino, English, Bahasa Indonesia o Mandarin.",
    ruleSeconds: "Hanggang {max} segundo bawat sagot. Maaari kang mag-record muli anumang bilang ng beses bago isumite.",
    ruleAi: "Ang bawat sagot ay agad sinusuri ng AI. Maaari ka lamang magpatuloy kapag pumasa.",
    ruleEnv: "Pumili ng tahimik at maliwanag na lugar, at payagan ang camera at microphone.",
    privacy: "Privacy: ang mga recording mo ay gagamitin lamang para sa recruitment assessment na ito at pangangalagaan ayon sa batas ng privacy.",
    agreeStart: "Sumang-ayon at Magsimula",
    finished: "Tapos na ang Interview",
    finishedDesc: "Salamat sa pagkumpleto ng video interview, {name}. Aabisuhan ka namin sa resulta.",
    finishedClose: "Maaari mo nang isara ang pahinang ito.",
    allDone: "Kumpleto na ang lahat ng tanong",
    allDoneDesc: "Pindutin ang button sa ibaba para isumite ang interview. Bubuo ang system ng kabuuang assessment report.",
    finishSubmit: "Tapusin at Isumite",
    submitting: "Isinusumite…",
    progressOf: "Tanong {x} / {n}",
    attemptsLeft: "{n} na pagkakataon pa para sa tanong na ito",
    analyzing: "Sinusuri ang iyong sagot…",
    analyzingHint: "Humigit-kumulang 10 segundo. Huwag isara ang pahinang ito.",
    stepUpload: "Nag-a-upload ng video",
    stepAnalyze: "Sinusuri ng AI ang iyong sagot",
    startRecord: "Simulan ang Recording",
    recordHint: "Kapag handa ka na, pindutin ang button at sagutin habang nakaharap sa camera.",
    recordingLeft: "Nagre-record… {s}s na lang",
    doneAnswer: "Tapos na ang Sagot",
    retake: "I-record Muli",
    submitAnswer: "Isumite ang Sagot",
    uploading: "Nag-a-upload…",
    playQuestion: "I-play ang tanong",
    replayQuestion: "I-play muli",
    langLabel: "Wika",
    errCamera: "Hindi ma-access ang camera/microphone. Suriin ang browser permissions at subukan muli.",
  },
  zh: {
    loading: "加载中…",
    reload: "重新加载",
    footer: "本页面由 NEXUSLINK 提供技术支持",
    title: "视频面试",
    hello: "{name}，你好",
    welcome: "欢迎参加本次视频面试，请先阅读以下事项再开始。",
    ruleCount: "共 {n} 道问题，请用普通话、英语、印尼语或菲律宾语逐题口头回答。",
    ruleSeconds: "每道题录制上限 {max} 秒，提交前可反复重录。",
    ruleAi: "回答会由 AI 即时分析，通过后才会进入下一题。",
    ruleEnv: "请在安静、光线充足的环境作答，并允许浏览器使用摄像头和麦克风。",
    privacy: "隐私声明：你录制的视频仅用于本次招聘评估，我们会按《个人资料（私隐）条例》妥善保存及处理。",
    agreeStart: "同意并开始",
    finished: "面试已完成",
    finishedDesc: "谢谢你完成视频面试，{name}。我们会尽快通知你结果。",
    finishedClose: "你可以关闭此页面了。",
    allDone: "全部问题已完成",
    allDoneDesc: "请点击下面按钮提交面试，系统会生成整体评估报告。",
    finishSubmit: "完成并提交面试",
    submitting: "提交中…",
    progressOf: "第 {x} / {n} 题",
    attemptsLeft: "本题剩余 {n} 次机会",
    analyzing: "AI 分析中，请稍候…",
    analyzingHint: "约需 10 秒，请勿关闭页面。",
    stepUpload: "上傳視頻",
    stepAnalyze: "AI 分析你的回答",
    startRecord: "开始录制回答",
    recordHint: "准备好后点击下方按钮，对着镜头回答本题。",
    recordingLeft: "录制中… 剩余 {s} 秒",
    doneAnswer: "完成作答",
    retake: "重新录制",
    submitAnswer: "提交回答",
    uploading: "上传中…",
    playQuestion: "播放题目",
    replayQuestion: "重播",
    langLabel: "语言",
    errCamera: "无法开启摄像头/麦克风，请检查浏览器权限后重试。",
  },
};
