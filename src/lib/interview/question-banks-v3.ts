/**
 * 題庫 v3（2026-10-23）：Basic 50 題新劇本 + 五份甲方評分表
 * 來源：docs/basic cv questions.docx + docs/ 五份評分表
 *
 * - BASIC50_QUESTIONS：Basic Plan 新初審問卷（basic-* 章節，前雇主按合約迴圈）
 * - ASSESSMENT_QUESTIONS：Advanced 附加測試章節嘅評分題（binary / scale / DISC choice）
 * - rubric 隨種子寫入 interview_questions.rubric 列，AI 按標準自動評分
 */

import { EMPLOYER_LOOP_TEMPLATE, type QuestionSection, type SharedQuestion } from "./shared-questions";

// ════════════════════════════════════════════════════════════════
// 評分標準（rubric）類型
// ════════════════════════════════════════════════════════════════

/** PASS/FAIL 二值評分（嬰幼兒/小童/寵物/家務烹飪 12 題評分表） */
export interface RubricBinary {
  kind: "binary";
  max: 1;
  /** PASS 關鍵標準（AI 對照回答判斷） */
  passKeys: string[];
  /** FAIL 關鍵標準 */
  failKeys: string[];
  /** 粵語原文提問（AI 評分語境 + 參考） */
  promptYue: string;
}

/** 三檔評分 5/3/1（綜合能力 6 道情境題） */
export interface RubricScale {
  kind: "scale";
  max: 5;
  bands: { 5: string; 3: string; 1: string };
  /** 模組歸屬：M1 記憶力 / M2 實用IQ / M3 情商EQ / M4 逆境AQ（每模組 2 題，各 /5，合計 /10） */
  module: "M1" | "M2" | "M3" | "M4";
  promptYue: string;
}

/** DISC 選擇題（10 題，每題 A/B/C/D 對應 D/I/S/C） */
export interface RubricChoice {
  kind: "choice";
  options: { key: "A" | "B" | "C" | "D"; disc: "D" | "I" | "S" | "C"; text: Record<string, string> }[];
}

export type QuestionRubric = RubricBinary | RubricScale | RubricChoice;

export interface AssessmentQuestion {
  section: string;
  question: string;
  rubric: QuestionRubric;
}

// ════════════════════════════════════════════════════════════════
// 前雇主迴圈泛化（basic-employer 9 題/位 + adv-employer 6 題/位）
// ════════════════════════════════════════════════════════════════

export interface LoopSectionDef {
  /** 問前僱主總數嘅題目原文（答完觸發數量選擇） */
  countText: string;
  /** 迴圈模板（可含 [k]；basic 模板無 [k]，由客戶端加「僱主#k」前綴） */
  templates: SharedQuestion[];
}

/** 各 Plan 嘅前雇主迴圈章節定義（key = 章節 category） */
export const LOOP_SECTIONS: Record<string, LoopSectionDef> = {
  "basic-employer": {
    countText: "How many past employers or work contracts have you had in total?",
    templates: [
      { section: "basic-employer", question: "Which country was this previous job located in?" },
      { section: "basic-employer", question: "What was the nationality of your employer?" },
      { section: "basic-employer", question: "How many family members were in the household?" },
      { section: "basic-employer", question: "What was the service period for this contract?" },
      { section: "basic-employer", question: "What was the size of the flat or house?" },
      { section: "basic-employer", question: "What were your exact duties in that household?" },
      { section: "basic-employer", question: "Did you have your own room or share a room?" },
      { section: "basic-employer", question: "Did you work with co-helpers or work alone?" },
      { section: "basic-employer", question: "What was your reason for leaving that contract?" },
    ],
  },
  // Advanced 70 題主體嘅前僱主迴圈（模板定義喺 shared-questions.ts CORE70_QUESTIONS）
  "adv-employer": {
    countText: "How many past employers or work contracts have you had in total?",
    templates: EMPLOYER_LOOP_TEMPLATE,
  },
};

// ════════════════════════════════════════════════════════════════
// Basic 50 題新劇本（basic cv questions.docx）
// ════════════════════════════════════════════════════════════════

export const BASIC_SECTIONS: QuestionSection[] = [
  { key: "basic-personal", label: { yue: "個人紀錄", zh: "个人纪录", en: "Personal Profile", id: "Profil Pribadi", tl: "Personal na Profile" } },
  { key: "basic-language", label: { yue: "語文能力", zh: "语文能力", en: "Language Proficiency", id: "Kemampuan Bahasa", tl: "Kakayahan sa Wika" } },
  { key: "basic-screening", label: { yue: "一般諮詢", zh: "一般咨询", en: "General Information Screening", id: "Penyaringan Informasi Umum", tl: "Pagsasala ng Pangkalahatang Impormasyon" } },
  { key: "basic-workexp", label: { yue: "工作經驗", zh: "工作经验", en: "Work Experience & Competency", id: "Pengalaman Kerja & Kompetensi", tl: "Karanasan sa Trabaho" } },
  { key: "basic-employer", label: { yue: "前僱主工作紀錄", zh: "前雇主工作纪录", en: "Previous Employer History", id: "Riwayat Majikan Sebelumnya", tl: "Kasaysayan ng Dating Amo" } },
  { key: "basic-declaration", label: { yue: "聲明確認", zh: "声明确认", en: "Final Declaration", id: "Deklarasi Akhir", tl: "Pangwakas na Deklarasyon" } },
];

export const BASIC_SECTION_KEYS = BASIC_SECTIONS.map((s) => s.key);

/** 迴圈數量題（Q41 之後、Q42 之前插入；與 Advanced 用同一原文） */
export const BASIC_EMPLOYER_COUNT = LOOP_SECTIONS["basic-employer"].countText;

export const BASIC50_QUESTIONS: SharedQuestion[] = [
  // ─── Section 1: Personal Profile（Q1–14）───
  { section: "basic-personal", question: "What is your full name?" },
  { section: "basic-personal", question: "What is your nationality?" },
  { section: "basic-personal", question: "What is your religion?" },
  { section: "basic-personal", question: "What is your date of birth?" },
  { section: "basic-personal", question: "What is your age?" },
  { section: "basic-personal", question: "What is your weight in kg?" },
  { section: "basic-personal", question: "What is your height in feet or centimeters?" },
  { section: "basic-personal", question: "What is your marital status?" },
  { section: "basic-personal", question: "How many sons do you have?" },
  { section: "basic-personal", question: "How many daughters do you have?" },
  { section: "basic-personal", question: "How many brothers do you have?" },
  { section: "basic-personal", question: "How many sisters do you have?" },
  { section: "basic-personal", question: "What is your birth order among siblings?" },
  { section: "basic-personal", question: "What is your highest education level?" },

  // ─── Section 2: Language Proficiency（Q15–17）───
  { section: "basic-language", question: "How is your Cantonese ability?" },
  { section: "basic-language", question: "How is your English ability?" },
  { section: "basic-language", question: "How is your Mandarin ability?" },

  // ─── Section 3: General Information Screening（Q18–31）───
  { section: "basic-screening", question: "Do you smoke?" },
  { section: "basic-screening", question: "Do you drink alcohol?" },
  { section: "basic-screening", question: "Do you eat pork?" },
  { section: "basic-screening", question: "Are you willing to handle pork?" },
  { section: "basic-screening", question: "Are you willing to take your day off on a day that is not Sunday?" },
  { section: "basic-screening", question: "Are you willing to accept monetary compensation to work on your holidays?" },
  { section: "basic-screening", question: "Are you willing to work for a family without your own room?" },
  { section: "basic-screening", question: "Are you willing to share job duties with other helpers?" },
  { section: "basic-screening", question: "Are you willing to take care of big dogs or big pets?" },
  { section: "basic-screening", question: "Do you accept security cameras at the employer's home in non-private areas?" },
  { section: "basic-screening", question: "Are you willing to take care of disabled elderly, help them take a bath, change diapers, go to the toilet, and accompany them to hospital?" },
  { section: "basic-screening", question: "Do you have driving experience?" },
  { section: "basic-screening", question: "Are you disabled or do you have any chronic diseases?" },
  { section: "basic-screening", question: "Do you have any tattoos?" },

  // ─── Section 4: Work Experience & Competency（Q32–41）───
  { section: "basic-workexp", question: "Do you have experience taking care of newborn babies?" },
  { section: "basic-workexp", question: "Do you have experience taking care of children?" },
  { section: "basic-workexp", question: "Do you have experience taking care of the elderly?" },
  { section: "basic-workexp", question: "Do you have experience taking care of disabled persons?" },
  { section: "basic-workexp", question: "Do you have cooking experience? What cuisine (Chinese, Western, Arabic, others)?" },
  { section: "basic-workexp", question: "Do you have general housework and hand-washing experience?" },
  { section: "basic-workexp", question: "Do you have experience caring for pets?" },
  { section: "basic-workexp", question: "How many total years of work experience do you have in Hong Kong?" },
  { section: "basic-workexp", question: "How many total years of work experience do you have in the Middle East?" },
  { section: "basic-workexp", question: "How many total years of work experience do you have in other countries (such as Singapore, Taiwan, Malaysia)?" },

  // ─── Section 5: Previous Employer History（迴圈：先問數量，再按每份合約問 9 題）───
  { section: "basic-employer", question: BASIC_EMPLOYER_COUNT },
  ...LOOP_SECTIONS["basic-employer"].templates,

  // ─── Section 6: Final Declaration（誠信聲明朗讀確認）───
  { section: "basic-declaration", question: "Do you declare that all information given in this document and attached CV is true, correct, and complete? Do you agree to allow the agency to process and present your data to potential employers in Hong Kong?" },
];

// ════════════════════════════════════════════════════════════════
// 五份甲方評分表（Advanced 附加測試章節）
// 每題附 rubric：AI 按 passKeys/failKeys（binary）或 bands（scale）自動評分
// ════════════════════════════════════════════════════════════════

/** 三檔錄用建議閾值（各 12 題評分表通用）：10–12 優先 / 7–9 後備 / ≤6 拒絕 */
export const BINARY_TIERS = [
  { min: 10, tier: "highly-recommend", label: { zh: "優先聘用", en: "Highly Recommend" } },
  { min: 7, tier: "acceptable", label: { zh: "後備考慮", en: "Acceptable" } },
  { min: 0, tier: "reject", label: { zh: "不作考慮", en: "Reject" } },
] as const;

/** DISC 型描述（D/I/S/C），評分表註：S 與 C 型最適合一般家庭 */
export const DISC_PROFILES: Record<string, { label: string; description: string }> = {
  D: { label: "支配型（D）", description: "行動力強、主導欲高，適合需要快速決斷嘅家庭。" },
  I: { label: "影響型（I）", description: "熱情健談、善於互動，適合有小朋友、鍾意熱鬧氣氛嘅家庭。" },
  S: { label: "穩健型（S）", description: "沉穩耐心、服從性高，最適合一般家庭（甲方建議）。" },
  C: { label: "謹慎型（C）", description: "細緻守規、重視標準，最適合一般家庭（甲方建議）。" },
};

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  // ═══════ 嬰幼兒 (0-2歲) 照顧評分表（12 題）═══════
  { section: "infant-care", question: "What water temperature should you use for formula milk, and how do you test if it is too hot before feeding the baby?", rubric: { kind: "binary", max: 1, promptYue: "沖奶粉要用幾多度水？給 BB 喝之前，點樣測試會唔會太燙？", passKeys: ["70°C", "70度", "手腕內側", "滴在手腕", "test on wrist"], failKeys: ["沸水", "開水", "冷水沖", "用嘴試", "直接餵"] } },
  { section: "infant-care", question: "If the baby does not burp after 10 minutes of burping, how do you prevent spitting up when putting the baby down in the crib?", rubric: { kind: "binary", max: 1, promptYue: "BB 飲完奶掃風10分鐘都唔打嗝，放落床你可以點做避免吐奶？", passKeys: ["頭高腳低", "側睡", "側臥", "墊高", "抱耐啲"], failKeys: ["立即平躺", "直接平躺", "隨意放落床"] } },
  { section: "infant-care", question: "If the baby is choking on milk or a foreign object and turning blue, what is your immediate action?", rubric: { kind: "binary", max: 1, promptYue: "如果 BB 畀奶/異物噎住、嘴唇發紫，你第一時間點救？", passKeys: ["拍背", "壓胸", "back blows", "chest thrusts", "叫救護車", "call ambulance", "急救"], failKeys: ["拍頭", "挖嘴巴", "盲目挖", "唔知點做", "等佢自己好"] } },
  { section: "infant-care", question: "Can you put plush toys, big pillows or thick blankets in the baby's crib? Why or why not?", rubric: { kind: "binary", max: 1, promptYue: "BB 嬰兒床上可以放毛公仔、大枕頭或厚被子嗎？點解？", passKeys: ["唔可以", "不可以", "清空", "keep crib empty", "仰睡", "窒息", "SIDS"], failKeys: ["可以", "放公仔", "厚被", "趴睡"] } },
  { section: "infant-care", question: "What is the correct sequence for running bath water, and would you leave the baby alone to grab shampoo outside?", rubric: { kind: "binary", max: 1, promptYue: "放洗澡水順序係咩？發現洗頭水喺出面，會行開拿嗎？", passKeys: ["先放冷水", "冷水先", "手肘試溫", "elbow", "唔會離開", "不離開", "視線範圍"], failKeys: ["先放熱水", "熱水先", "行開", "離開", "留 BB 一個"] } },
  { section: "infant-care", question: "How do you prepare solid food (puree) for a 6-month-old baby, and what should you watch out for when cooking fish?", rubric: { kind: "binary", max: 1, promptYue: "6個月 BB 糊仔點煮？煮魚肉要特別留意咩？", passKeys: ["去骨", "去刺", "打爛", "細滑", "唔加鹽", "不加調味", "no salt"], failKeys: ["唔去骨", "不去骨刺", "加鹽", "加味精", "成人調味"] } },
  { section: "infant-care", question: "If the baby runs a high fever (38.5°C) in the middle of the night, what are your steps?", rubric: { kind: "binary", max: 1, promptYue: "半夜發現 BB 發燒(38.5°C)，你嘅處理步驟係咩？", passKeys: ["量體溫", "探熱", "換輕衣", "溫水抹身", "通知僱主", "告訴雇主", "退燒藥"], failKeys: ["蓋厚被", "焗汗", "成人藥", "唔通知"] } },
  { section: "infant-care", question: "How often should you change the baby's diaper, and how do you handle diaper rash?", rubric: { kind: "binary", max: 1, promptYue: "尿片多久換一次？有紅屁股點處理？", passKeys: ["2-3小時", "兩三個鐘", "便後即換", "溫水洗", "擦乾", "屁屁膏", "nappy cream"], failKeys: ["半天", "好耐先換", "大力擦", "濕紙巾搓"] } },
  { section: "infant-care", question: "How do you clean and sterilize milk bottles after use, and how often?", rubric: { kind: "binary", max: 1, promptYue: "奶樽用完點清潔同消毒？多久消毒一次？", passKeys: ["拆開刷洗", "刷子", "蒸氣", "UV", "消毒機", "每日消毒", "每次"], failKeys: ["清水沖", "唔消毒", "不消毒"] } },
  { section: "infant-care", question: "If the baby cries non-stop and refuses milk and sleep, what order do you check things in?", rubric: { kind: "binary", max: 1, promptYue: "BB 無故大哭、唔肯飲奶唔肯睡，你按咩順序檢查？", passKeys: ["尿片", "發燒", "腸絞痛", "衣服", "安撫", "檢查"], failKeys: ["大聲呵斥", "搖晃", "大力搖", "鬧佢"] } },
  { section: "infant-care", question: "When the baby starts crawling, what safety hazards should you watch for in the living room and on the changing table?", rubric: { kind: "binary", max: 1, promptYue: "BB 開始爬，客廳同換片枱有咩危險要注意？", passKeys: ["手不離", "插座", "桌角", "細小物件", "圍欄"], failKeys: ["留喺高處", "無人看管", "睇手機"] } },
  { section: "infant-care", question: "How must you hold a 0-3 month old baby, and why?", rubric: { kind: "binary", max: 1, promptYue: "抱 0-3 個月大嘅 BB，手勢一定要點做？點解？", passKeys: ["托住頭頸", "support head", "頭頸", "頸肌未發育"], failKeys: ["單手抱", "頭部向後仰", "隨意抱"] } },

  // ═══════ 小童至青少年 (3-15歲) 照顧評估表（12 題）═══════
  { section: "child-care", question: "A child plays iPad non-stop after school and refuses to do homework. What do you do? Would you compromise?", rubric: { kind: "binary", max: 1, promptYue: "小朋友放學一直玩iPad唔肯做功課，你點做？會妥協嗎？", passKeys: ["家規", "堅定", "定時", "轉移注意", "唔妥協", "不妥協"], failKeys: ["放任", "隱瞞", "幫忙隱瞞", "大聲呵斥"] } },
  { section: "child-care", question: "After school, how do you arrange the child's schedule for homework, revision and rest?", rubric: { kind: "binary", max: 1, promptYue: "放學後，你點安排小朋友做功課、溫習同休息時間表？", passKeys: ["順序", "功課先", "溫習", "手冊", "時間表"], failKeys: ["無計劃", "隨意", "唔理功課"] } },
  { section: "child-care", question: "At school pickup, a stranger claims to be a 'friend of the parents' and wants to take the child. What do you do?", rubric: { kind: "binary", max: 1, promptYue: "接放學有陌生人話係「父母朋友」要接走佢，你點做？", passKeys: ["唔放人", "不放", "打電話", "確認", "聯絡僱主"], failKeys: ["隨意", "讓對方帶走", "睇手機"] } },
  { section: "child-care", question: "A child throws a tantrum in public demanding a toy. How do you handle it?", rubric: { kind: "binary", max: 1, promptYue: "小朋友街上鬧脾氣哭鬧一定要買玩具，你點應對？", passKeys: ["冷靜", "堅定", "唔買", "帶離現場", "安撫"], failKeys: ["妥協", "買玩具", "大聲罵", "當街鬧"] } },
  { section: "child-care", question: "If a teenager talks back to you or has a bad attitude, how do you handle it?", rubric: { kind: "binary", max: 1, promptYue: "青少年如果不理你、頂嘴或者態度不好，你會點做？", passKeys: ["唔對罵", "保持禮貌", "尊重", "事後告知", "通知僱主"], failKeys: ["對罵", "冷暴力", "體罰", "打罵"] } },
  { section: "child-care", question: "A child refuses vegetables and only wants snacks and soft drinks. How do you handle it?", rubric: { kind: "binary", max: 1, promptYue: "小朋友唔肯食菜只想食零食飲汽水，點處理？", passKeys: ["鼓勵", "切碎", "混入飯菜", "唔隨意畀零食"], failKeys: ["零食代正餐", "強行硬塞", "放任"] } },
  { section: "child-care", question: "Do you do everything for the child, or guide them to do things themselves (like packing their school bag)?", rubric: { kind: "binary", max: 1, promptYue: "你會幫小朋友做完所有嘢(如收書包)，定教佢自己做？", passKeys: ["引導", "教佢自己", "培養", "責任感"], failKeys: ["代做所有", "伺候", "放任凌亂"] } },
  { section: "child-care", question: "How do you prevent a child getting lost in a crowded mall, and what do you do if they get lost?", rubric: { kind: "binary", max: 1, promptYue: "去人多商場點防範走失？走失咗點做？", passKeys: ["視線", "緊隨", "工作人員", "警察", "999", "聯絡僱主"], failKeys: ["睇手機", "不知所措", "唔知點辦"] } },
  { section: "child-care", question: "When caring for older children (7-12 years old), what privacy boundaries apply for bathing and changing clothes?", rubric: { kind: "binary", max: 1, promptYue: "照顧大個少少嘅小朋友(7-12歲)，洗澡換衫有咩界線？", passKeys: ["尊重隱私", "關門", "自行洗澡", "協助"], failKeys: ["無界線", "不關門", "過度觸碰"] } },
  { section: "child-care", question: "If a child gets a cut, bumps their head, or gets burned, what is your first aid?", rubric: { kind: "binary", max: 1, promptYue: "小朋友跌親流血、撞到頭或燙傷，第一時間點處理？", passKeys: ["沖冷水", "按壓", "觀察", "通知僱主", "急救"], failKeys: ["亂塗藥膏", "忽視", "唔通知"] } },
  { section: "child-care", question: "If you find a child lying, stealing things, or chatting with strangers online, what do you do?", rubric: { kind: "binary", max: 1, promptYue: "發現小朋友講大話、偷拿東西或私下上網交友？", passKeys: ["回報僱主", "通知雇主", "冷靜", "唔隱瞞", "不幫忙隱瞞"], failKeys: ["幫忙隱瞞", "私下保密", "收好處"] } },
  { section: "child-care", question: "If a child has a serious accident, is unconscious or bleeding heavily, what phone number do you call first?", rubric: { kind: "binary", max: 1, promptYue: "小朋友發生嚴重意外昏迷或大出血，第一時間打咩電話？", passKeys: ["999", "報警", "救護"], failKeys: ["唔知", "等僱主返嚟", "等僱主回家"] } },

  // ═══════ 照顧寵物評估表（12 題）═══════
  { section: "pet-care", question: "Which human foods or plants are toxic and dangerous to dogs or cats?", rubric: { kind: "binary", max: 1, promptYue: "你知道有咩食物或植物對貓狗係劇毒，絕對唔食得嗎？", passKeys: ["朱古力", "巧克力", "chocolate", "葡萄", "grape", "洋蔥", "onion", "木糖醇", "百合", "lily"], failKeys: ["人食得寵物就食得", "餵剩菜", "唔知"] } },
  { section: "pet-care", question: "How do you hold the dog leash during a walk, and what do you do if an aggressive dog approaches?", rubric: { kind: "binary", max: 1, promptYue: "出街散步狗繩要點握？遇到猛狗衝過來點做？", passKeys: ["緊握", "唔睇手機", "拉開距離", "擋喺狗前"], failKeys: ["唔拉繩", "放繩", "睇手機", "聽歌"] } },
  { section: "pet-care", question: "If the dog tries to eat street trash, how do you stop it? How do you clean up poop during walks?", rubric: { kind: "binary", max: 1, promptYue: "狗狗街上亂咬垃圾點阻止？便便點清理？", passKeys: ["拉緊", "拉開", "便便袋", "執屎", "水沖"], failKeys: ["放任", "唔清理", "唔帶袋"] } },
  { section: "pet-care", question: "When opening doors or windows, how do you prevent cats from escaping or jumping out?", rubric: { kind: "binary", max: 1, promptYue: "開窗或開大門時，點樣確保貓隻唔會衝出去或跳樓？", passKeys: ["防貓網", "cat net", "鎖好", "留意", "窗網"], failKeys: ["唔理", "不關網", "任佢"] } },
  { section: "pet-care", question: "How often do you scoop the litter box, and what do you do if you see blood in urine or no stool?", rubric: { kind: "binary", max: 1, promptYue: "貓砂盆幾久清一次？發現血尿或無便便點做？", passKeys: ["每日", "1-2次", "記錄", "回報", "通知僱主"], failKeys: ["幾日先清", "忽視", "唔理"] } },
  { section: "pet-care", question: "Can you use Dettol or bleach to clean floors or pet toys? Why or why not?", rubric: { kind: "binary", max: 1, promptYue: "拖地或洗玩具可以用滴露或漂白水嗎？點解？", passKeys: ["滴露有毒", "寵物專用", "稀釋", "過水", "唔用得"], failKeys: ["可以", "直接用", "化學品洗碗"] } },
  { section: "pet-care", question: "Do you have experience bathing pets or cutting nails? What if you cut too deep and it bleeds?", rubric: { kind: "binary", max: 1, promptYue: "幫寵物洗澡/剪甲經驗？剪到流血點算？", passKeys: ["寵物洗毛精", "止血粉", "小心", "血管"], failKeys: ["人類洗髮水", "強行", "硬剪"] } },
  { section: "pet-care", question: "How often do you change the pet's drinking water and wash bowls? How do you control feeding portions?", rubric: { kind: "binary", max: 1, promptYue: "水碗幾久換一次水？點控制餵食份量？", passKeys: ["每日", "每日換", "洗碗", "份量"], failKeys: ["幾日先換", "唔洗", "過量"] } },
  { section: "pet-care", question: "If a pet growls or guards its food, how do you handle it?", rubric: { kind: "binary", max: 1, promptYue: "寵物低吼發脾氣或護食，你點處理？", passKeys: ["唔招惹", "冷靜空間", "唔打擾", "等佢冷靜"], failKeys: ["呵斥", "打罵", "搶食物"] } },
  { section: "pet-care", question: "How can you tell if a pet is sick (poor appetite, lethargy, vomiting)?", rubric: { kind: "binary", max: 1, promptYue: "你點樣觀察狗狗/貓貓生病唔舒服？", passKeys: ["食慾", "精神", "嘔吐", "腹瀉", "回報"], failKeys: ["唔知", "以為瞓覺", "忽視"] } },
  { section: "pet-care", question: "Do you know how to give pills or apply spot-on flea drops to a pet? Where do you apply the drops?", rubric: { kind: "binary", max: 1, promptYue: "識唔識給寵物餵藥片或滴驅蟲藥？滴喺邊度？", passKeys: ["後頸", "頸背", "餵藥器", "肉泥包藥"], failKeys: ["肚皮", "硬塞", "唔識"] } },
  { section: "pet-care", question: "If a pet suddenly faints, has seizures, or eats something poisonous, what is your immediate action?", rubric: { kind: "binary", max: 1, promptYue: "寵物突然昏迷抽搐或食毒物，你第一時間點做？", passKeys: ["獸醫", "24小時", "通知僱主", "即時"], failKeys: ["唔知點辦", "等僱主下班", "不知所措"] } },

  // ═══════ 香港標準家務與烹飪評分表（12 題）═══════
  { section: "housework-cooking", question: "What three Hong Kong style dishes can you cook well, and how do you make steamed eggs smooth?", rubric: { kind: "binary", max: 1, promptYue: "你擅長煮邊 3 道廣東菜？蒸水蛋要點做先會滑？", passKeys: ["蒸魚", "蒸蛋", "溫水", "過篩", "慢火", "火候"], failKeys: ["唔識", "不會", "唔知火候"] } },
  { section: "housework-cooking", question: "If given recipes or YouTube videos, are you willing to learn new dishes?", rubric: { kind: "binary", max: 1, promptYue: "如果畀中英菜譜或YouTube影片，願唔願意學新菜？", passKeys: ["願意", "樂意", "積極", "學習"], failKeys: ["拒絕", "唔學", "只煮自己嗰啲"] } },
  { section: "housework-cooking", question: "How do you separate chopping boards and knives for raw and cooked food? Where do you store raw meat in the fridge?", rubric: { kind: "binary", max: 1, promptYue: "處理生肉同熟食，砧板點分開？生肉放雪櫃邊層？", passKeys: ["分開", "生熟分開", "最下層", "密封"], failKeys: ["混用", "生肉放上面", "唔分開"] } },
  { section: "housework-cooking", question: "How do you choose fresh fish and vegetables at the wet market, and how do you wash a fish before steaming?", rubric: { kind: "binary", max: 1, promptYue: "點樣揀新鮮嘅魚同青菜？點洗蒸魚？", passKeys: ["魚眼", "鰓紅", "去血塊", "去腥", "浸水"], failKeys: ["唔識揀", "唔去血", "唔洗"] } },
  { section: "housework-cooking", question: "How do you clean heavy grease on the range hood? What cleaning products and steps?", rubric: { kind: "binary", max: 1, promptYue: "抽油煙機油污好難洗，你用咩清潔劑同步驟？", passKeys: ["除油劑", "degreaser", "熱水", "浸泡", "油網"], failKeys: ["濕布", "唔拆", "唔知"] } },
  { section: "housework-cooking", question: "How do you remove mold and keep the bathroom dry in Hong Kong's humid weather?", rubric: { kind: "binary", max: 1, promptYue: "香港潮濕，浴室玻璃膠發霉，你點樣去霉同防潮？", passKeys: ["漂白水", "刮乾", "squeegee", "抹乾", "去霉"], failKeys: ["任由", "唔抹", "唔理"] } },
  { section: "housework-cooking", question: "Can you use bleach on marble or solid wood furniture? Why or why not?", rubric: { kind: "binary", max: 1, promptYue: "大理石(Marble)或實木傢俬可以用漂白水擦嗎？", passKeys: ["唔可以", "禁用", "酸鹼", "微濕布", "會問"], failKeys: ["可以", "隨意用"] } },
  { section: "housework-cooking", question: "How do you sort laundry? Can dark and white clothes be washed together?", rubric: { kind: "binary", max: 1, promptYue: "洗衫點分類？深色同白色衫可以一齊洗嗎？", passKeys: ["深淺分開", "分開洗", "內衣", "洗衣袋"], failKeys: ["一齊洗", "混洗", "唔分"] } },
  { section: "housework-cooking", question: "How do you control the iron temperature, and how do you wash wool sweaters?", rubric: { kind: "binary", max: 1, promptYue: "熨衫溫度點掌握？羊毛衫(Wool)點洗？", passKeys: ["標籤", "care label", "調溫", "冷水手洗"], failKeys: ["唔睇標籤", "高溫", "燙焦"] } },
  { section: "housework-cooking", question: "How do you prioritize your morning: going to the market, laundry, cleaning the bathroom, and cooking lunch?", rubric: { kind: "binary", max: 1, promptYue: "早上要買菜、洗衫、清潔洗手間同煮飯，點安排順序？", passKeys: ["洗衫先", "買菜", "順序", "安排", "計劃"], failKeys: ["無條理", "手忙腳亂", "唔知點安排"] } },
  { section: "housework-cooking", question: "How do you prevent cockroaches and pests? How often do you empty kitchen trash?", rubric: { kind: "binary", max: 1, promptYue: "點防曱甴蚊蟲？廚餘垃圾幾久倒一次？", passKeys: ["每日倒", "唔留過夜", "即時洗碗", "廚餘"], failKeys: ["過夜", "幾日先倒", "泡水"] } },
  { section: "housework-cooking", question: "Can you mix bleach with acidic cleaners? What are the safety rules for cleaning windows?", rubric: { kind: "binary", max: 1, promptYue: "漂白水同酸性清潔劑可混用嗎？抹窗有咩安全規矩？", passKeys: ["唔可以混", "絕不混", "鎖窗花", "唔伸出窗外", "安全帶"], failKeys: ["可以混", "混用", "攀爬", "伸出窗外"] } },
];

// ═══════ 綜合能力及性格測試（6 道情境題 scale + 10 道 DISC 選擇題）═══════
// 章節 label 喺 shared-questions.ts ADVANCED_SECTIONS（key: comprehensive）

export const COMPREHENSIVE_QUESTIONS: AssessmentQuestion[] = [
  // ── 模組 1：記憶力（M1，每題 /5，合計 /10）──
  { section: "comprehensive", question: "I need you to remember 4 important things for me: 1 bottle of fresh milk from the supermarket, 2 boxes of Panadol from the pharmacy, 3 red apples from the fruit stall, and pick up the child at 4:30 PM. Please repeat these 4 items to me now, and remember them — I will ask you about them later.", rubric: { kind: "scale", max: 5, module: "M1", promptYue: "請幫我記住 4 件重要的事：1. 超市買 1 盒鮮奶；2. 藥房買 2 盒必理痛；3. 街市買 3 個紅蘋果；4. 下午 4:30 去接小孩。請而家重複一次並記住，等等我會問你。", bands: { 5: "無需提示，準確說出所有物品、數量及時間", 3: "記得 2–3 樣，或數量/時間稍有混淆，經微提示後能想起來", 1: "完全忘記，或只能記起 1 樣，明顯健忘" } } },
  { section: "comprehensive", question: "Please listen carefully to this 4-step instruction for washing the baby's bottle: Step 1: rinse with warm water. Step 2: wash with special detergent using a sponge. Step 3: put into the sterilizer and press the red button. Step 4: dry your hands before taking the bottles out and placing them in the clean cupboard. Can you repeat these 4 steps in the exact order?", rubric: { kind: "scale", max: 5, module: "M1", promptYue: "請仔細聽清洗奶瓶嘅 4 個步驟：1 溫水沖洗；2 海綿加清潔劑刷洗；3 放消毒機按紅掣；4 洗淨抹乾雙手先取出，放入乾淨櫃子。請按順序重複一次。", bands: { 5: "能流利、精準地按邏輯順序複述 4 個步驟", 3: "步驟順序打亂但內容大致正確", 1: "無法吸收超過 2 個步驟，多步驟記憶力較弱" } } },
  // ── 模組 2：實用 IQ（M2）──
  { section: "comprehensive", question: "Imagine: it is 5:30 PM and you are frying chicken on the gas stove. Suddenly three things happen at the same time: A. the baby wakes up crying loudly in the bedroom; B. the doorbell rings — a courier is delivering a package; C. the pot on the stove starts smoking heavily. What will you do first, second, and third? Explain your reason.", rubric: { kind: "scale", max: 5, module: "M2", promptYue: "想像：下午 5:30 你喺廚房煎緊雞翼，突然三件事同時發生：A BB 喺房大哭；B 門鈴響（快遞）；C 個鍋大量冒煙。你會按咩順序處理？解釋原因。", bands: { 5: "安全優先：先關煤氣爐/移開鍋 → 查看/抱起嬰兒 → 抱著嬰兒開門", 3: "先抱嬰兒再關火最後開門（忽略廚房火災風險）", 1: "先去開門拿快遞，或手忙腳亂不知所措" } } },
  { section: "comprehensive", question: "I give you $100 to buy choy sum and pork for tonight's dinner. At the market, choy sum is completely sold out and the pork stall is closed today. What will you do?", rubric: { kind: "scale", max: 5, module: "M2", promptYue: "我畀你 $100 買菜芯同豬肉做晚餐，去到街市菜芯賣晒、豬肉檔休息。你會點做？", bands: { 5: "主動溝通：即刻問僱主換咩菜；聯絡唔到就揀最接近嘅蔬菜肉類，唔會亂買", 3: "買其他常見菜肉回去，事後先話俾僱主知", 1: "空手回家，或亂買貴價不合口味嘅食材" } } },
  // ── 模組 3：情商 EQ（M3）──
  { section: "comprehensive", question: "Suppose you spent 3 hours deep cleaning the living room and felt very tired. When your employer comes home, she says: 'This is not clean at all! Look at the corners, there is still dust. Clean it all over again right now.' How do you feel inside, and what will you say or do?", rubric: { kind: "scale", max: 5, module: "M3", promptYue: "假設你花 3 個鐘深層清潔客廳，好辛苦；僱主返嚟話：『一啲都唔乾淨！角頭仲有塵，而家即刻重新打掃！』你心裡點諗？會點回應處理？", bands: { 5: "謙虛受教：保持禮貌，誠懇道歉並請僱主指出唔乾淨嘅地方，即刻改善", 3: "心有唔開心或委屈，但唔會講出嚟，默默重做", 1: "防禦心強：黑面、抱怨『我已經好辛苦』或同僱主爭辯" } } },
  { section: "comprehensive", question: "If the elderly person or child you care for gets very bad-tempered, refuses to eat, and says mean words like: 'I hate you! You cook horribly, get out of my home!' How will you react?", rubric: { kind: "scale", max: 5, module: "M3", promptYue: "如果你照顧嘅長者或小孩脾氣暴躁、唔肯食飯，仲鬧你：『我討厭你！你煮飯難食死，滾出我家！』你會點反應？", bands: { 5: "高同理心：唔發火，冷靜溫和安撫，或先退開確保安全，事後向僱主求助", 3: "會難過甚至自己躲起嚟喊，但唔會對長者小孩發脾氣", 1: "衝動對撞：大聲鬧返轉頭、冷暴力懲罰對方" } } },
  // ── 模組 4：逆境 AQ（M4）──
  { section: "comprehensive", question: "Working in Hong Kong means being away from your kids and family for 2 years. In the first 3 months, if you feel extremely homesick, lonely, and cry every night, how will you manage your stress during the daytime so it does not affect your housework and care quality?", rubric: { kind: "scale", max: 5, module: "M4", promptYue: "喺香港工作即係要離開家人 2 年。頭 3 個月如果你極度思鄉、晚晚偷喊，你會點樣喺日間排解壓力，確保唔影響家務同照顧工作？", bands: { 5: "目標導向：提醒自己嚟香港嘅目的，日間專注工作令自己忙碌，休息時祈禱或傾訴", 3: "會打電話俾家人哭訴，需要時間適應，但勉強維持到工作", 1: "抗壓極低：控制唔到情緒，日間頻出错失神，甚至嚷住要斷約返鄉" } } },
  { section: "comprehensive", question: "Imagine you are ironing clothes and accidentally burn a hole in Madam's very expensive designer dress. Nobody saw you do it. What is the very first thing you will do?", rubric: { kind: "scale", max: 5, module: "M4", promptYue: "想像你熨衫時唔小心燙焦咗太太一件好貴嘅名牌衫，當時冇人見到。你第一時間會做咩？", bands: { 5: "100% 誠實：絕不隱瞞，即刻影相存證，僱主返嚟第一時間主動認錯道歉，願承擔責任", 3: "唔敢主動坦白，等僱主發現問起先承認道歉", 1: "撒謊推卸：藏喺衣櫃深處、掉咗佢，或者話係人整壞" } } },
];

// ── DISC 性格測試（10 道選擇題；zh/en 為原文，id/tl/yue 由種子翻譯補齊）──

export const DISC_QUESTIONS: AssessmentQuestion[] = [
  { section: "comprehensive", question: "When your employer suddenly brings guests home and changes your daily routine, what will you do?", rubric: { kind: "choice", options: [
    { key: "A", disc: "D", text: { zh: "迅速採取行動，掌控局面，快速準備好一切。", en: "Take charge and do things quickly." } },
    { key: "B", disc: "I", text: { zh: "熱情迎接客人，面帶微笑，讓他們感到賓至如歸。", en: "Warmly welcome guests, smile, and chat." } },
    { key: "C", disc: "S", text: { zh: "雖然有點壓力，但會保持冷靜，盡量按部就班地服務。", en: "Calmly adjust and patiently serve." } },
    { key: "D", disc: "C", text: { zh: "詢問雇主非常具體的指示，確保每一個細節都不出錯。", en: "Ask for exact, detailed instructions." } },
  ] } },
  { section: "comprehensive", question: "When learning to use a new and complex home appliance (like a high-end oven), what is your habit?", rubric: { kind: "choice", options: [
    { key: "A", disc: "D", text: { zh: "直接按按鈕嘗試，邊做邊學。", en: "Just press buttons and figure it out by trying." } },
    { key: "B", disc: "I", text: { zh: "請別人示範並講解給我聽。", en: "Ask someone to show and explain it to me." } },
    { key: "C", disc: "S", text: { zh: "慢慢看別人做，然後自己重複練習幾次。", en: "Watch slowly and practice it repeatedly." } },
    { key: "D", disc: "C", text: { zh: "仔細閱讀說明書，了解每一個功能才開始用。", en: "Read the manual carefully before touching it." } },
  ] } },
  { section: "comprehensive", question: "How do you prefer your employer to give you work instructions?", rubric: { kind: "choice", options: [
    { key: "A", disc: "D", text: { zh: "簡短、直接，只告訴我要什麼結果。", en: "Short and direct, just tell me the final result." } },
    { key: "B", disc: "I", text: { zh: "用聊天的方式，帶有鼓勵和讚美。", en: "Friendly chat with some praise and encouragement." } },
    { key: "C", disc: "S", text: { zh: "語氣溫和，一步一步慢慢教。", en: "Gentle, step-by-step, in a calm voice." } },
    { key: "D", disc: "C", text: { zh: "寫在紙上，列出清單和非常詳細的標準。", en: "Written down in detail, like a checklist." } },
  ] } },
  { section: "comprehensive", question: "When the toddler you are caring for suddenly throws a crying tantrum, what is your first reaction?", rubric: { kind: "choice", options: [
    { key: "A", disc: "D", text: { zh: "語氣堅定地制止他，讓他立刻轉移注意力。", en: "Firmly tell them to stop and redirect them." } },
    { key: "B", disc: "I", text: { zh: "扮鬼臉、唱歌或玩遊戲來逗他開心。", en: "Make funny faces and sing to distract them." } },
    { key: "C", disc: "S", text: { zh: "耐心地抱著他，安靜地等他慢慢平靜下來。", en: "Hold them patiently and wait to calm down." } },
    { key: "D", disc: "C", text: { zh: "檢查他的生理需求（是否換尿布/餓了），按程序處理。", en: "Check schedule and needs: hungry? diaper?" } },
  ] } },
  { section: "comprehensive", question: "If you need to share housework with a co-worker or an elderly family member and you have a disagreement, what will you do?", rubric: { kind: "choice", options: [
    { key: "A", disc: "D", text: { zh: "直接指出來，要求對方按正確的方法做。", en: "Confront directly and tell them to do it right." } },
    { key: "B", disc: "I", text: { zh: "開個玩笑帶過，盡量保持氣氛和諧。", en: "Make a joke and try to keep everyone happy." } },
    { key: "C", disc: "S", text: { zh: "避免衝突，自己多做一點沒關係，維持和平。", en: "Avoid conflict, do the extra work myself." } },
    { key: "D", disc: "C", text: { zh: "拿出雇主的規定或時間表，要求嚴格分工。", en: "Point out the rules and schedule, divide work strictly." } },
  ] } },
  { section: "comprehensive", question: "What is your usual work pace and rhythm?", rubric: { kind: "choice", options: [
    { key: "A", disc: "D", text: { zh: "節奏很快，想盡快把事情做完。", en: "Fast-paced, want to get everything done early." } },
    { key: "B", disc: "I", text: { zh: "有時快有時慢，喜歡邊做邊跟小孩/長輩互動。", en: "Variable, often interact while working." } },
    { key: "C", disc: "S", text: { zh: "非常穩定，每天都在固定的時間做固定的事。", en: "Steady, doing the same routine every day." } },
    { key: "D", disc: "C", text: { zh: "比較慢但極度細心，一定要確保每個角落都乾淨。", en: "Precise and careful, takes time to be perfect." } },
  ] } },
  { section: "comprehensive", question: "What motivates you the most in your work?", rubric: { kind: "choice", options: [
    { key: "A", disc: "D", text: { zh: "雇主信任我，讓我自己決定怎麼完成家務。", en: "Being trusted to handle things on my own." } },
    { key: "B", disc: "I", text: { zh: "雇主的讚美，以及家裡開心的氣氛。", en: "Praise, feeling liked, and a happy atmosphere." } },
    { key: "C", disc: "S", text: { zh: "一個和平、不吵鬧、有規律的家庭環境。", en: "A peaceful, quiet home with a stable routine." } },
    { key: "D", disc: "C", text: { zh: "把事情做到完美，完全沒有犯錯。", en: "Doing things perfectly without making mistakes." } },
  ] } },
  { section: "comprehensive", question: "If you accidentally break a normal glass cup, what will you do?", rubric: { kind: "choice", options: [
    { key: "A", disc: "D", text: { zh: "迅速清理乾淨，這不是什麼大問題。", en: "Clean it up quickly and move on." } },
    { key: "B", disc: "I", text: { zh: "不斷道歉，解釋當時發生的情況。", en: "Apologize a lot and explain how it happened." } },
    { key: "C", disc: "S", text: { zh: "安靜地清理，心裡覺得很內疚，擔心一整天。", en: "Quietly clean it, feel worried all day." } },
    { key: "D", disc: "C", text: { zh: "報告雇主，分析為什麼會打破，並保證下次遵守規則。", en: "Report it, analyze, and promise to follow rules." } },
  ] } },
  { section: "comprehensive", question: "When organizing kitchen cabinets or the fridge, what is your habit?", rubric: { kind: "choice", options: [
    { key: "A", disc: "D", text: { zh: "把最常用的東西放在最順手的地方就好。", en: "Put things where they are easy to grab quickly." } },
    { key: "B", disc: "I", text: { zh: "只要外表看起來整齊就好，裡面沒關係。", en: "Make it look nice on the outside." } },
    { key: "C", disc: "S", text: { zh: "保持雇主原本設定好的擺放位置，不隨便改動。", en: "Keep everything exactly where the employer put them." } },
    { key: "D", disc: "C", text: { zh: "把物品分類、貼標籤、按過期日排好。", en: "Categorize everything, label them, arrange by date." } },
  ] } },
  { section: "comprehensive", question: "If your employer asks you to do a complex household chore that you have never done before, what will you do?", rubric: { kind: "choice", options: [
    { key: "A", disc: "D", text: { zh: "充滿自信，馬上動手試試看。", en: "Confident, try to do it right away." } },
    { key: "B", disc: "I", text: { zh: "雖然有點擔心，但會笑著說沒問題，邊問邊做。", en: "Smile, say no problem, and ask while doing." } },
    { key: "C", disc: "S", text: { zh: "會有點緊張，希望雇主能先帶著我做一次。", en: "A bit nervous, hope employer can do it with me first." } },
    { key: "D", disc: "C", text: { zh: "請問雇主有沒有具體的指引或教學影片可以參考。", en: "Ask for detailed guidelines or video tutorials." } },
  ] } },
];

/** 綜合能力及性格測試全部題目（scale 情境題 + DISC 選擇題） */
export const COMPREHENSIVE_ALL: AssessmentQuestion[] = [
  ...COMPREHENSIVE_QUESTIONS,
  ...DISC_QUESTIONS,
];

/** assessments 用嘅章節標題（AI 評分輸出） */
export const ASSESSMENT_SECTION_TITLES: Record<string, { zh: string; en: string }> = {
  "infant-care": { zh: "嬰幼兒 (0-2歲) 照顧", en: "Infant & Toddler Care" },
  "child-care": { zh: "小童至青少年 (3-15歲) 照顧", en: "Child & Teen Care" },
  "pet-care": { zh: "照顧寵物", en: "Pet Care" },
  "housework-cooking": { zh: "香港標準家務與烹飪", en: "Housekeeping & Cooking" },
  comprehensive: { zh: "綜合能力及性格測試", en: "Comprehensive Ability & Personality" },
};
