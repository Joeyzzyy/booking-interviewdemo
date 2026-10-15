/**
 * 公共題庫（customer_id IS NULL）：《DOMESTIC HELPER CV DATA COLLECTION INTERVIEW FORM》
 * 全部 72 題（含第 6 章引導題），按 9 個章節分類。
 *
 * - 所有登入用戶共享呢份題庫；用戶另可加自己嘅自定義問題
 * - 種子數據由 scripts/seed-shared-questions.ts 寫入 interview_questions（category = 章節 key）
 * - 題目原文為英文；5 語譯文 + TTS 音頻由 generateQuestionAssets 生成
 */

/** 章節定義（順序即展示順序）；label 五語：粵/简/英/印尼/菲（覆蓋站點三語 + 工人端五語） */
export interface QuestionSection {
  key: string;
  label: { yue: string; zh: string; en: string; id: string; tl: string };
}

export const QUESTION_SECTIONS: QuestionSection[] = [
  { key: "administrative", label: { yue: "行政資料", zh: "行政资料", en: "Administrative Information", id: "Informasi Administrasi", tl: "Impormasyong Administratibo" } },
  { key: "personal", label: { yue: "個人資料", zh: "个人资料", en: "Personal Information", id: "Informasi Pribadi", tl: "Personal na Impormasyon" } },
  { key: "skills", label: { yue: "核心技能自評", zh: "核心技能自评", en: "Core Skill Self-Assessment", id: "Penilaian Diri Keterampilan Inti", tl: "Pagtatasa ng Pangunahing Kasanayan" } },
  { key: "language", label: { yue: "語言能力", zh: "语言能力", en: "Language Proficiency", id: "Kemampuan Bahasa", tl: "Kakayahan sa Wika" } },
  { key: "country", label: { yue: "各國工作經驗", zh: "各国工作经验", en: "Country Experience Summary", id: "Ringkasan Pengalaman Kerja per Negara", tl: "Buod ng Karanasan sa Bawat Bansa" } },
  { key: "history", label: { yue: "僱傭歷史", zh: "雇佣历史", en: "Employment History Record", id: "Riwayat Pekerjaan", tl: "Kasaysayan ng Trabaho" } },
  { key: "willingness", label: { yue: "工作意願", zh: "工作意愿", en: "General Willingness Questions", id: "Pertanyaan Kesediaan Umum", tl: "Mga Tanong sa Kahandaan" } },
  { key: "preferences", label: { yue: "偏好與可到崗時間", zh: "偏好与可到岗时间", en: "Preferences & Availability", id: "Preferensi & Ketersediaan", tl: "Mga Kagustuhan at Availability" } },
  { key: "legal", label: { yue: "法律同意與聲明", zh: "法律同意与声明", en: "Legal Consents & Declarations", id: "Persetujuan & Pernyataan Hukum", tl: "Mga Legal na Pahintulot at Deklarasyon" } },
];

/** 語言（站點 yue/cmn/en 或工人端 en/id/tl/zh/yue）→ 章節顯示名 */
export function sectionLabel(
  key: string,
  locale: "yue" | "cmn" | "zh" | "en" | "id" | "tl"
): string {
  const section = QUESTION_SECTIONS.find((s) => s.key === key);
  if (!section) return key;
  if (locale === "zh" || locale === "cmn") return section.label.zh;
  return section.label[locale] || section.label.en;
}

export interface SharedQuestion {
  /** 章節 key（QUESTION_SECTIONS.key） */
  section: string;
  /** 題目原文（英文） */
  question: string;
}

export const SHARED_QUESTIONS: SharedQuestion[] = [
  // ─── Section 1: Administrative Information ───
  { section: "administrative", question: "What is your Maid/Candidate ID number?" },
  { section: "administrative", question: "What is your current contract status?" },

  // ─── Section 2: Personal Information ───
  { section: "personal", question: "What is your full name?" },
  { section: "personal", question: "What is your nationality?" },
  { section: "personal", question: "What is your religion?" },
  { section: "personal", question: "What is your date of birth?" },
  { section: "personal", question: "How old are you?" },
  { section: "personal", question: "What is your height in centimeters?" },
  { section: "personal", question: "What is your weight in kilograms?" },
  { section: "personal", question: "What is your highest level of education completed?" },
  { section: "personal", question: "What is your marital status?" },
  { section: "personal", question: "How many sons do you have?" },
  { section: "personal", question: "How many daughters do you have?" },
  { section: "personal", question: "How many brothers do you have?" },
  { section: "personal", question: "How many sisters do you have?" },
  { section: "personal", question: "What is your birth order among your siblings?" },

  // ─── Section 3: Core Skill Self-Assessment ───
  { section: "skills", question: "Do you have experience in taking care of babies?" },
  { section: "skills", question: "Do you have experience in taking care of children?" },
  { section: "skills", question: "Do you have experience in taking care of the elderly?" },
  { section: "skills", question: "Do you have experience in taking care of disabled individuals?" },
  { section: "skills", question: "Do you have experience in cooking?" },
  { section: "skills", question: "Do you have experience in general housework?" },
  { section: "skills", question: "Do you have experience in pet care?" },

  // ─── Section 4: Language Proficiency ───
  { section: "language", question: "How would you rate your Cantonese speaking ability?" },
  { section: "language", question: "How would you rate your English speaking ability?" },
  { section: "language", question: "How would you rate your Mandarin speaking ability?" },

  // ─── Section 5: Country Experience Summary ───
  { section: "country", question: "How many years of work experience do you have in Hong Kong?" },
  { section: "country", question: "How many years of work experience do you have in Singapore?" },
  { section: "country", question: "How many years of work experience do you have in Taiwan?" },
  { section: "country", question: "How many years of work experience do you have in Malaysia?" },
  { section: "country", question: "How many years of work experience do you have in the Middle East or Saudi Arabia?" },
  { section: "country", question: "How many years of work experience do you have in Indonesia?" },
  { section: "country", question: "How many years of work experience do you have in the Philippines?" },
  { section: "country", question: "How many years of work experience do you have in any other country?" },

  // ─── Section 6: Employment History Record ───
  { section: "history", question: "How many jobs have you worked before as a domestic helper?" },
  { section: "history", question: "Which district or location was your past employer located in?" },
  { section: "history", question: "What was the nationality of your employer?" },
  { section: "history", question: "What were the start and end years of your service period with this employer?" },
  { section: "history", question: "How many family members were living in the household?" },
  { section: "history", question: "What was the size of the flat in square feet?" },
  { section: "history", question: "Did you care for babies in this job?" },
  { section: "history", question: "Did you care for children in this job? If yes, what were their ages?" },
  { section: "history", question: "Did you care for adults in this job? If yes, who?" },
  { section: "history", question: "Did you care for elderly members in this job? If yes, what was their health status?" },
  { section: "history", question: "Did you care for disabled members in this job? If yes, what was their condition?" },
  { section: "history", question: "Did you handle general housework?" },
  { section: "history", question: "Did you do hand-washing for clothes?" },
  { section: "history", question: "Did you cook? If yes, what type of cuisine?" },
  { section: "history", question: "Did you go to the market for grocery shopping?" },
  { section: "history", question: "Did you perform car washing?" },
  { section: "history", question: "Did you work together with co-helpers? If yes, how many?" },
  { section: "history", question: "Did you care for pets in this household?" },
  { section: "history", question: "Did you share a room with anyone in this household?" },
  { section: "history", question: "What was your reason for leaving this employer?" },

  // ─── Section 7: General Willingness Questions ───
  { section: "willingness", question: "Do you smoke?" },
  { section: "willingness", question: "Do you drink alcohol?" },
  { section: "willingness", question: "Do you eat pork?" },
  { section: "willingness", question: "Are you willing to handle pork?" },
  { section: "willingness", question: "Are you willing to take your day off on days other than Sunday?" },
  { section: "willingness", question: "Are you willing to receive financial payment instead of taking holiday time off?" },
  { section: "willingness", question: "Are you willing to work for a family where you do not have your own private room?" },
  { section: "willingness", question: "Are you willing to share job duties with other helpers?" },
  { section: "willingness", question: "Are you willing to care for big dogs or large pets?" },
  { section: "willingness", question: "Do you accept security cameras in non-private areas of the employer's home?" },
  { section: "willingness", question: "Are you willing to assist disabled elderly with bathing, changing diapers, using the toilet, and hospital visits?" },
  { section: "willingness", question: "Do you have any tattoos?" },

  // ─── Section 8: Preferences & Availability ───
  { section: "preferences", question: "What date will your current contract officially end?" },
  { section: "preferences", question: "Do you need to return to your home country before starting a new job?" },
  { section: "preferences", question: "Do you have any specific personal preferences or requests for your next job?" },
  { section: "preferences", question: "Are there any special remarks or strengths you would like to note?" },

  // ─── Section 9: Legal Consents & Declarations ───
  { section: "legal", question: "Do you grant consent for your personal data and profile to be published on our agency website or branches for prospective employers?" },
  { section: "legal", question: "Do you declare that all information provided in this CV is true, accurate, and complete, acknowledging full legal liability for any false details?" },
];
