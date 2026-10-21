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

/**
 * Advanced Plan（自製 CV）測試章節 —— 8 個分類，題目見 ADVANCED_QUESTIONS。
 * 與 QUESTION_SECTIONS 同構；僅 Advanced 訂閱用戶發起面試時可勾選出題。
 */
export const ADVANCED_SECTIONS: QuestionSection[] = [
  { key: "basic-info", label: { yue: "基本資料", zh: "基本资料", en: "Basic Information", id: "Informasi Dasar", tl: "Pangunahing Impormasyon" } },
  { key: "personality", label: { yue: "性格測試", zh: "性格测试", en: "Personality Test", id: "Tes Kepribadian", tl: "Pagsusuri ng Pagkatao" } },
  { key: "aptitude", label: { yue: "IQ / AQ / EQ / 記憶測試", zh: "IQ / AQ / EQ / 记忆测试", en: "IQ / AQ / EQ / Memory Test", id: "Tes IQ / AQ / EQ / Memori", tl: "Pagsusuri ng IQ / AQ / EQ / Memorya" } },
  { key: "elderly-care", label: { yue: "長者照顧", zh: "长者照顾", en: "Elderly Care", id: "Perawatan Lansia", tl: "Pag-aalaga sa Matatanda" } },
  { key: "pet-care", label: { yue: "寵物照顧測試", zh: "宠物照顾测试", en: "Pet Care Test", id: "Tes Perawatan Hewan Peliharaan", tl: "Pagsusuri sa Pag-aalaga ng Alagang Hayop" } },
  { key: "housework-cooking", label: { yue: "家務與烹飪測試", zh: "家务与烹饪测试", en: "Housework & Cooking Test", id: "Tes Pekerjaan Rumah & Memasak", tl: "Pagsusuri sa Gawaing Bahay at Pagluluto" } },
  { key: "child-care", label: { yue: "小童及青少年照顧測試", zh: "小童及青少年照顾测试", en: "Child & Teen Care Test", id: "Tes Perawatan Anak & Remaja", tl: "Pagsusuri sa Pag-aalaga ng Bata at Teenager" } },
  { key: "infant-care", label: { yue: "嬰幼兒照顧測試", zh: "婴幼儿照顾测试", en: "Infant Care Test", id: "Tes Perawatan Bayi & Balita", tl: "Pagsusuri sa Pag-aalaga ng Sanggol" } },
];

/** 全部章節（Basic 題庫 9 章 + Advanced 8 章） */
export const ALL_QUESTION_SECTIONS: QuestionSection[] = [
  ...QUESTION_SECTIONS,
  ...ADVANCED_SECTIONS,
];

/** 語言（站點 yue/cmn/en 或工人端 en/id/tl/zh/yue）→ 章節顯示名（含 Advanced 章節） */
export function sectionLabel(
  key: string,
  locale: "yue" | "cmn" | "zh" | "en" | "id" | "tl"
): string {
  const section = ALL_QUESTION_SECTIONS.find((s) => s.key === key);
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

/**
 * Advanced Plan（自製 CV）公共題庫：8 個測試章節 × 8 題 = 64 題。
 * 題目原文為英文；5 語譯文 + TTS 由 seed 腳本生成。
 * 與 SHARED_QUESTIONS 一併由 scripts/seed-shared-questions.ts 入庫。
 */
export const ADVANCED_QUESTIONS: SharedQuestion[] = [
  // ─── 2.1 Basic Information ───
  { section: "basic-info", question: "Please introduce yourself: your full name, age, nationality, and hometown." },
  { section: "basic-info", question: "What is your highest level of education, and which school did you attend?" },
  { section: "basic-info", question: "Are you married? Do you have children? How old are they?" },
  { section: "basic-info", question: "What is your religion, and do you have any dietary restrictions?" },
  { section: "basic-info", question: "How many siblings do you have, and what is your position in the family?" },
  { section: "basic-info", question: "What languages can you speak and understand? Please rate each one." },
  { section: "basic-info", question: "Do you have any work experience outside your home country? Where and for how long?" },
  { section: "basic-info", question: "When are you available to start work, and how soon can you travel to Hong Kong?" },

  // ─── 2.2 Personality Test ───
  { section: "personality", question: "How would your previous employer describe your personality in three words?" },
  { section: "personality", question: "When you make a mistake at work, what do you usually do?" },
  { section: "personality", question: "If your employer gives you feedback you disagree with, how do you respond?" },
  { section: "personality", question: "Do you prefer working independently or following instructions? Why?" },
  { section: "personality", question: "Describe a time you felt stressed at work and how you handled it." },
  { section: "personality", question: "If a family member in your home country has an emergency while you are working, what would you do?" },
  { section: "personality", question: "What do you usually do in your free time? How do you recharge?" },
  { section: "personality", question: "Are you more of a morning person or a night person? How does that affect your work?" },

  // ─── 2.3 IQ / AQ / EQ / Memory Test ───
  { section: "aptitude", question: "If a recipe says to cook rice for 20 minutes and vegetables for 10 minutes, and both must be ready at the same time, when should you start each one?" },
  { section: "aptitude", question: "You have HK$100. You spend HK$35 on vegetables and HK$20 on rice. How much change should you get back?" },
  { section: "aptitude", question: "Please repeat these five items after me: apple,钥匙， Monday, green, 7." },
  { section: "aptitude", question: "A bus leaves at 8:15 AM and the journey takes 45 minutes. What time does it arrive?" },
  { section: "aptitude", question: "If the employer changes your schedule at the last minute, how would you feel and what would you do?" },
  { section: "aptitude", question: "Your employer seems upset but hasn't told you why. What would you do?" },
  { section: "aptitude", question: "Describe a difficult situation at work you faced and the steps you took to solve it." },
  { section: "aptitude", question: "You notice a colleague doing their job incorrectly. Would you tell anyone? Why or why not?" },

  // ─── 2.4 Elderly Care ───
  { section: "elderly-care", question: "Have you cared for an elderly person before? Please describe their condition and what you did daily." },
  { section: "elderly-care", question: "An elderly person refuses to eat. What would you try?" },
  { section: "elderly-care", question: "What would you do if an elderly person falls down and cannot get up?" },
  { section: "elderly-care", question: "How do you help an elderly person take a bath safely?" },
  { section: "elderly-care", question: "What should you watch for when giving medicine to an elderly person?" },
  { section: "elderly-care", question: "An elderly person with dementia keeps asking the same question. How do you respond?" },
  { section: "elderly-care", question: "How would you keep an elderly person company and support their emotional well-being?" },
  { section: "elderly-care", question: "Do you know how to measure blood pressure or blood sugar? Please explain." },

  // ─── 2.5 Pet Care Test ───
  { section: "pet-care", question: "Have you taken care of pets before? What kind of animals?" },
  { section: "pet-care", question: "How many times a day should a dog be fed and walked?" },
  { section: "pet-care", question: "A dog is barking loudly at night. What would you check and do?" },
  { section: "pet-care", question: "How do you clean a cat's litter box, and how often?" },
  { section: "pet-care", question: "What would you do if a pet looks sick or refuses to eat?" },
  { section: "pet-care", question: "Are you comfortable giving a pet a bath? How would you do it?" },
  { section: "pet-care", question: "How would you keep a pet safe when the employer is not home?" },
  { section: "pet-care", question: "Are you afraid of any animals? Would that affect your work?" },

  // ─── 2.6 Housework & Cooking Test ───
  { section: "housework-cooking", question: "Walk me through your daily routine for cleaning a home from morning to evening." },
  { section: "housework-cooking", question: "Name three Chinese dishes you can cook well and describe how you cook one of them." },
  { section: "housework-cooking", question: "How do you wash and iron clothes without damaging them?" },
  { section: "housework-cooking", question: "How would you clean a bathroom thoroughly? What products and steps?" },
  { section: "housework-cooking", question: "The employer asks for a meal in 30 minutes but you haven't prepared anything. What do you do?" },
  { section: "housework-cooking", question: "How do you keep the kitchen clean while cooking to prevent pests?" },
  { section: "housework-cooking", question: "Do you know how to use a washing machine, microwave, and rice cooker?" },
  { section: "housework-cooking", question: "How would you plan grocery shopping for a week for a family of four?" },

  // ─── 2.7 Child & Teen Care Test ───
  { section: "child-care", question: "Have you taken care of children or teenagers before? What ages?" },
  { section: "child-care", question: "A 6-year-old refuses to do homework and starts crying. What would you do?" },
  { section: "child-care", question: "How would you prepare simple, healthy meals and snacks for children?" },
  { section: "child-care", question: "What safety rules would you follow when taking a child to the playground?" },
  { section: "child-care", question: "A teenager talks back to you and ignores your instructions. How do you handle it?" },
  { section: "child-care", question: "What would you do if a child has a fever while the parents are at work?" },
  { section: "child-care", question: "How do you help children build good habits, like tidying up toys or brushing teeth?" },
  { section: "child-care", question: "Do you know how to help a child with basic schoolwork, like reading or simple math?" },

  // ─── 2.8 Infant Care Test ───
  { section: "infant-care", question: "Have you cared for a newborn or infant before? Please describe your experience." },
  { section: "infant-care", question: "How often does a newborn baby need to be fed, and how do you prepare formula milk?" },
  { section: "infant-care", question: "How do you bathe a baby safely? Describe the steps." },
  { section: "infant-care", question: "How do you change a diaper and prevent diaper rash?" },
  { section: "infant-care", question: "What are the signs that a baby is unwell and needs a doctor?" },
  { section: "infant-care", question: "How do you put a baby to sleep safely? What should you never do?" },
  { section: "infant-care", question: "A baby is crying non-stop. Walk me through what you would check." },
  { section: "infant-care", question: "How would you keep bottles and feeding equipment clean and sterilized?" },
];
