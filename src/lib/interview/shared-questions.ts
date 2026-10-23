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
 * Advanced Plan（自製 CV）附加測試章節 —— 7 個分類（2026-10 v3）：
 * 評分表 5 章（嬰幼兒/小童青少年/寵物/家務烹飪/綜合能力性格，題目見 question-banks-v3.ts ASSESSMENT_QUESTIONS）
 * + 保留 2 章（基本資料/長者照顧，題目仍在本文件 ADVANCED_QUESTIONS 對應分類）。
 * 與 QUESTION_SECTIONS 同構；僅 Advanced 訂閱用戶發起面試時可勾選出題。
 */
export const ADVANCED_SECTIONS: QuestionSection[] = [
  { key: "basic-info", label: { yue: "基本資料", zh: "基本资料", en: "Basic Information", id: "Informasi Dasar", tl: "Pangunahing Impormasyon" } },
  { key: "elderly-care", label: { yue: "長者照顧", zh: "长者照顾", en: "Elderly Care", id: "Perawatan Lansia", tl: "Pag-aalaga sa Matatanda" } },
  { key: "infant-care", label: { yue: "嬰幼兒 (0-2歲) 照顧", zh: "婴幼儿 (0-2岁) 照顾", en: "Infant & Toddler Care", id: "Perawatan Bayi & Balita", tl: "Pag-aalaga sa Sanggol at Bata" } },
  { key: "child-care", label: { yue: "小童至青少年照顧", zh: "小童及青少年照顾", en: "Child & Teen Care", id: "Perawatan Anak & Remaja", tl: "Pag-aalaga ng Bata at Tin-edyser" } },
  { key: "pet-care", label: { yue: "寵物照顧測試", zh: "宠物照顾测试", en: "Pet Care Test", id: "Tes Perawatan Hewan Peliharaan", tl: "Pagsusuri sa Pag-aalaga ng Alagang Hayop" } },
  { key: "housework-cooking", label: { yue: "家務與烹飪測試", zh: "家务与烹饪测试", en: "Housework & Cooking Test", id: "Tes Pekerjaan Rumah & Memasak", tl: "Pagsusuri sa Gawaing Bahay at Pagluluto" } },
  { key: "comprehensive", label: { yue: "綜合能力及性格測試", zh: "综合能力及性格测试", en: "Comprehensive Ability & Personality Test", id: "Tes Kemampuan Komprehensif & Kepribadian", tl: "Pagsusuri ng Kakayahan at Pagkatao" } },
];

// ════════════════════════════════════════════════════════════════
// Advanced Plan v2 主體題庫：外傭全方位履歷、健康與安全審查表
// 來源：甲方《advanced CV questions.pdf》70 題單一提問劇本（11 章）
// - Q28 問前僱主總數；Q29–34 為迴圈模板（[k] = 第幾位僱主），
//   客戶端按答案動態生成每位僱主的 6 題，TTS 音頻複用模板題
// - Q70 作品照片走面試後獨立上傳步驟（photos 列），此處僅為口頭引導題
// ════════════════════════════════════════════════════════════════

/** Advanced v2 主體章節（70 題，必做）；與 ADVANCED_SECTIONS（8 章附加測試）並存 */
export const CORE_SECTIONS: QuestionSection[] = [
  { key: "adv-personal", label: { yue: "個人紀錄", zh: "个人纪录", en: "Personal Data", id: "Data Pribadi", tl: "Personal na Datos" } },
  { key: "adv-family", label: { yue: "家庭背景及思鄉風險", zh: "家庭背景及思乡风险", en: "Family Background & Home Sick Risk", id: "Latar Belakang Keluarga & Risiko Homesick", tl: "Background ng Pamilya at Risiko ng Homesick" } },
  { key: "adv-financial", label: { yue: "財政規劃與薪金分配", zh: "财政规划与薪金分配", en: "Financial Planning & Remittance", id: "Perencanaan Keuangan & Kiriman Uang", tl: "Pagpaplano ng Pinansya at Padala" } },
  { key: "adv-willingness", label: { yue: "工作經驗與意向", zh: "工作经验与意向", en: "Working Experience & Priorities", id: "Pengalaman Kerja & Prioritas", tl: "Karanasan sa Trabaho at Prioridad" } },
  { key: "adv-employer", label: { yue: "前僱主工作紀錄", zh: "前雇主工作纪录", en: "Last Employer Records", id: "Catatan Pekerjaan Majikan Terdahulu", tl: "Mga Rekord ng Dating Amo" } },
  { key: "adv-general", label: { yue: "一般諮詢", zh: "一般咨询", en: "General Information", id: "Informasi Umum", tl: "Pangkalahatang Impormasyon" } },
  { key: "adv-health", label: { yue: "身體與心智健康查核", zh: "身体与心智健康查核", en: "Physical & Mental Health", id: "Pemeriksaan Kesehatan Fisik & Mental", tl: "Pagsusuri ng Pisikal at Mental na Kalusugan" } },
  { key: "adv-social", label: { yue: "社交媒體與手機使用規矩", zh: "社交媒体与手机使用规矩", en: "Social Media & Phone Usage Rules", id: "Aturan Media Sosial & Penggunaan HP", tl: "Mga Patakaran sa Social Media at Paggamit ng Telepono" } },
  { key: "adv-security", label: { yue: "安全背景與誠信審查", zh: "安全背景与诚信审查", en: "Security & Legal Background", id: "Pemeriksaan Keamanan & Integritas", tl: "Pagsusuri ng Seguridad at Katapatan" } },
  { key: "adv-hobbies", label: { yue: "個人興趣與嗜好", zh: "个人兴趣与嗜好", en: "Hobbies & Interests", id: "Hobi & Minat", tl: "Mga Hilig at Interes" } },
  { key: "adv-portfolio", label: { yue: "實務作品照片", zh: "实务作品照片", en: "Portfolio & Dish Photos", id: "Foto Portofolio & Masakan", tl: "Mga Larawan ng Gawain at Luto" } },
];

/** 全部章節（Basic 題庫 9 章 + Advanced v2 主體 11 章 + Advanced 8 章附加測試） */
export const ALL_QUESTION_SECTIONS: QuestionSection[] = [
  ...QUESTION_SECTIONS,
  ...CORE_SECTIONS,
  ...ADVANCED_SECTIONS,
];

/** Basic 9 章 + Advanced 8 章附加測試的 key 集合（advanced plan 出題過濾用） */
export const ADVANCED_SECTION_KEYS: string[] = ADVANCED_SECTIONS.map((s) => s.key);
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

export const CORE70_QUESTIONS: SharedQuestion[] = [
  // ─── 一、個人紀錄 Personal Data（Q1–9）───
  { section: "adv-personal", question: "Can you tell me your full name?" },
  { section: "adv-personal", question: "What is your nationality?" },
  { section: "adv-personal", question: "How old are you?" },
  { section: "adv-personal", question: "Are you currently overseas, finished contract, or broke contract?" },
  { section: "adv-personal", question: "What is your religion?" },
  { section: "adv-personal", question: "What is your marital status (single, married, or divorced)?" },
  { section: "adv-personal", question: "What is your height and weight?" },
  { section: "adv-personal", question: "What is your highest completed education level?" },
  { section: "adv-personal", question: "Can you speak Cantonese, English, or Mandarin fluently?" },

  // ─── 二、家庭背景及思鄉風險（Q10–17）───
  { section: "adv-family", question: "Are your parents healthy or deceased?" },
  { section: "adv-family", question: "How many brothers and sisters do you have? What is your position in the family?" },
  { section: "adv-family", question: "What is your husband's occupation back home?" },
  { section: "adv-family", question: "Roughly what is your husband's monthly income?" },
  { section: "adv-family", question: "How many children do you have and how old are they?" },
  { section: "adv-family", question: "While you work in Hong Kong, who will take care of your children?" },
  { section: "adv-family", question: "Does your husband and family fully support your decision to work in Hong Kong?" },
  { section: "adv-family", question: "Under what family emergency at home would you feel forced to request leave and return home?" },

  // ─── 三、財政規劃與薪金分配（Q18–21）───
  { section: "adv-financial", question: "How many years do you plan or hope to work in Hong Kong in total?" },
  { section: "adv-financial", question: "When you receive your monthly salary, about what percentage will you send home?" },
  { section: "adv-financial", question: "About what percentage or amount will you keep for your own daily expenses?" },
  { section: "adv-financial", question: "What is the money sent home mainly used for (e.g., family daily budget, house building, debt repayment, tuition)?" },

  // ─── 四、工作經驗與意向（Q22–27）───
  { section: "adv-willingness", question: "Do you have experience taking care of newborn babies (0-2 yrs old), and are you willing to do so?" },
  { section: "adv-willingness", question: "Are you willing to take care of young children or teenagers?" },
  { section: "adv-willingness", question: "Are you willing to care for elderly family members?" },
  { section: "adv-willingness", question: "Are you willing to cook daily meals and learn Hong Kong style dishes?" },
  { section: "adv-willingness", question: "Are you willing to do general house cleaning and laundry?" },
  { section: "adv-willingness", question: "Are you willing to take care of pets like cats or dogs?" },

  // ─── 五、前僱主工作紀錄（Q28 問數量；Q29–34 迴圈模板，[k]=第幾位僱主）───
  { section: "adv-employer", question: "How many past employers or work contracts have you had in total?" },
  { section: "adv-employer", question: "For Employer #[k], where was the job located (e.g., Hong Kong, Singapore, home country)?" },
  { section: "adv-employer", question: "What were the start and end dates (Month/Year) of employment for Employer #[k]?" },
  { section: "adv-employer", question: "How large was the flat or house (in sq. ft.) for Employer #[k]?" },
  { section: "adv-employer", question: "How many family members were there, and how many helpers were in the house for Employer #[k]?" },
  { section: "adv-employer", question: "What were your exact daily duties for Employer #[k] (e.g., baby care, elder care, cooking, cleaning)?" },
  { section: "adv-employer", question: "What was the main reason you left or finished the contract with Employer #[k]?" },

  // ─── 六、一般諮詢 12 題（Q35–46）───
  { section: "adv-general", question: "Do you smoke?" },
  { section: "adv-general", question: "Do you drink alcohol?" },
  { section: "adv-general", question: "Do you eat pork?" },
  { section: "adv-general", question: "Are you willing to handle and cook pork?" },
  { section: "adv-general", question: "Are you willing to take your day off on a weekday instead of Sunday?" },
  { section: "adv-general", question: "Are you willing to work on your day off for extra payment?" },
  { section: "adv-general", question: "Are you willing to work for a family without a private helper room?" },
  { section: "adv-general", question: "Are you willing to share job duties with another helper in the same house?" },
  { section: "adv-general", question: "Are you willing to take care of big dogs or large pets?" },
  { section: "adv-general", question: "Do you accept security CCTV cameras in common non-private areas of the home?" },
  { section: "adv-general", question: "Are you willing to care for disabled elderly (bathing, changing diapers, hospital visits)?" },
  { section: "adv-general", question: "Do you have any tattoos on your body?" },

  // ─── 七、身體與心智健康查核（Q47–58）───
  { section: "adv-health", question: "What time do you usually go to sleep and wake up?" },
  { section: "adv-health", question: "Do you suffer from insomnia, sleepwalking, or heavy snoring?" },
  { section: "adv-health", question: "Are you able and willing to wake up at night to care for a baby or elderly person?" },
  { section: "adv-health", question: "Have you ever experienced uncontrolled temper, extreme mood swings, or breakdowns?" },
  { section: "adv-health", question: "Have you ever been diagnosed with anxiety or panic attacks?" },
  { section: "adv-health", question: "Have you ever been diagnosed with depression or taken psychiatric medications?" },
  { section: "adv-health", question: "Do you have eczema or skin allergies to dish soap or cleaners?" },
  { section: "adv-health", question: "Do you have any food allergies (seafood, peanuts, G6PD)?" },
  { section: "adv-health", question: "Have you ever had surgery, and in what year?" },
  { section: "adv-health", question: "Do you have hypertension, heart disease, diabetes, or asthma?" },
  { section: "adv-health", question: "Do you take any long-term daily medication?" },
  { section: "adv-health", question: "Have you been diagnosed with hepatitis B, TB, or epilepsy?" },

  // ─── 八、社交媒體與手機使用規矩（Q59–61）───
  { section: "adv-social", question: "Do you run any public Facebook, Instagram, TikTok, or YouTube accounts?" },
  { section: "adv-social", question: "Do you agree never to film or post pictures of your employer's home, family, or kids online?" },
  { section: "adv-social", question: "Strictly no phone usage during work hours except rest time. Is this house rule acceptable?" },

  // ─── 九、安全背景與誠信審查（Q62–67）───
  { section: "adv-security", question: "Have you ever been rejected for any visa to Hong Kong or other countries?" },
  { section: "adv-security", question: "Have you ever changed your legal name, surname, or date of birth in your passport?" },
  { section: "adv-security", question: "Do you have any criminal or arrest records in Hong Kong or back home?" },
  { section: "adv-security", question: "Is your CV work history 100 percent complete with no hidden short contracts?" },
  { section: "adv-security", question: "Do you have active loans with finance companies or act as a loan guarantor?" },
  { section: "adv-security", question: "Can you provide a reference letter or phone number of your last employer for verification?" },

  // ─── 十、個人興趣與嗜好（Q68–69）───
  { section: "adv-hobbies", question: "What are your favorite hobbies (e.g., cooking, baking, reading, gardening)?" },
  { section: "adv-hobbies", question: "What do you usually do and where do you go on your day off?" },

  // ─── 十一、實務作品照片（Q70，口頭引導；照片於面試後上傳步驟提交）───
  { section: "adv-portfolio", question: "Can you share 2-3 photos of dishes you cooked yourself, and 1-2 photos showing your past work duties? After this interview, please upload them on the next screen." },
];

/** 前僱主迴圈模板題（CORE70_QUESTIONS 中 adv-employer 章節的 Q29–34，即索引 8–13） */
export const EMPLOYER_LOOP_TEMPLATE = CORE70_QUESTIONS.filter(
  (q) => q.section === "adv-employer"
).slice(1);

/** 迴圈模板題的 [k] 替換（英文+五語譯文同規則替換） */
export function fillEmployerIndex(text: string, k: number): string {
  return text.replace(/\[k\]/g, String(k));
}
