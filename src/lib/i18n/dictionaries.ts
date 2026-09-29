import type { LocaleKey } from "./locales";

/**
 * 首頁 + 站點導航/頁腳的文案字典。
 * yue 為基準（TypeScript 以其結構推導 Messages 類型），cmn / en 必須保持同樣的鍵結構。
 */

const yue = {
  header: {
    nav: {
      services: "服務項目",
      process: "服務流程",
      interview: "AI 面試",
      about: "關於我們",
    },
    login: "登入 / 註冊",
    bookNow: "立即預約",
    account: "賬號中心",
    logout: "登出",
    logoutTitle: "登出？",
    logoutHint: "登出後需要重新驗證電郵或手機號才能再次登入。",
    cancel: "取消",
    confirmLogout: "確定登出",
    openMenu: "打開菜單",
    closeMenu: "關閉菜單",
    mainNav: "主導航",
    mobileNav: "移動端導航",
    language: "語言",
  },
  hero: {
    badge: "NEXUSLINK SERVICES LIMITED",
    title1: "前線交給你，",
    title2: "後勤交給我。",
    subtitle: "全方位支援僱傭中心，助您業務輕鬆起航——網上提交預約，專人確認跟進，訂單狀態全程透明。",
    ctaBook: "立即預約服務",
    ctaServices: "了解服務項目",
    trust: ["套票制透明收費", "訂單全程可跟進", "電郵 + 短訊雙通道登入", "專人確認安排"],
    imgAlt: "兩個人透過流線與節點彼此連結的品牌插畫",
  },
  services: {
    eyebrow: "服務項目",
    title: "工人服務・一站辦妥",
    subtitle: "由工人抵埗第一刻開始，接機、驗身、入屋跟進，每項服務都有專人對接，僱主全程掌握進度。",
    perTime: "/ 次",
    pack: (price: number) => `10 次套票 HK$${price}`,
    bookNow: "立即預約",
    items: {
      medical: {
        label: "陪同驗身",
        description: "專人陪同工人到指定診所進行驗身，協助登記及溝通。",
        includes: ["專人陪同往返診所", "協助登記及文件處理", "即時向僱主匯報結果"],
      },
      pickup: {
        label: "工人接機",
        description: "專人於香港國際機場接工人，安全送達指定地點。",
        includes: ["航班動態實時跟蹤", "接機並送達指定地址", "即時向僱主報平安"],
      },
      combo: {
        label: "驗身 + 接機",
        description: "接機與陪同驗身一併安排，工人到埗後流程無縫銜接。",
        includes: ["航班動態實時跟蹤", "接機並陪同驗身", "送達指定地址", "即時向僱主匯報"],
      },
      "full-pack": {
        label: "全部打包服務",
        description: "接機、驗身、入屋跟進等一站式安排，全程專人跟進。",
        includes: ["航班動態實時跟蹤", "接機並陪同驗身", "送達指定地址", "入屋跟進及後續支援"],
      },
    },
  },
  process: {
    eyebrow: "服務流程",
    title: "四步・完成預約",
    subtitle: "流程簡單直接，一環扣一環，每一步都有跡可循。",
    stepLabel: (n: number) => `第 ${n} 步`,
    steps: [
      {
        title: "註冊 / 登入",
        desc: "電郵或手機短訊驗證碼登入，首次登入即自動開戶，兩種方式可互相綁定。",
      },
      {
        title: "購買套票",
        desc: "按需購買單次或 10 次套票，收費透明，餘額隨時在賬戶內查看。",
      },
      {
        title: "提交預約",
        desc: "選擇服務、填寫工人資料並上傳文件，30 秒完成提交。",
      },
      {
        title: "專人確認跟進",
        desc: "我們確認後以電郵通知你，訂單狀態在賬戶內實時更新。",
      },
    ],
  },
  interview: {
    eyebrow: "AI 視頻面試",
    title: "面試評估・交給 AI 先過一遍",
    subtitle: "為合作機構而設的後台評估工具：建立面試、發送專屬連結給工人，AI 自動完成轉寫與評估，機構在後台查看逐題結果與整體報告。",
    imgAlt: "手機視頻面試的品牌插畫",
    features: [
      {
        title: "視頻作答",
        desc: "工人透過專屬連結逐題錄影作答，無需下載任何應用程式。",
      },
      {
        title: "AI 語音轉寫",
        desc: "自動將作答內容轉寫為文字，支持廣東話口音。",
      },
      {
        title: "逐題評估 + 整體報告",
        desc: "AI 按考察要點逐題判斷，並輸出整體評估報告供參考。",
      },
    ],
    note: "目前僅於管理後台開放給合作機構，暫不對個人用戶開放。",
  },
  about: {
    eyebrow: "關於我們",
    title: "以品質成就信賴，與僱傭中心並肩同行",
    subtitle: (brand: string) =>
      `${brand} 專注外傭後勤支援，把接機、驗身、住宿、培訓等繁瑣環節逐一辦妥，讓僱傭中心專注前線業務，無後顧之憂。`,
    vision: {
      eyebrow: "願景",
      title: "外傭後勤支援樞紐",
      desc: "成為亞太區最具信賴與創新力的外傭後勤支援樞紐，重新定義業界標準，讓每一份跨國信任都穩固而溫暖。",
    },
    mission: {
      eyebrow: "使命",
      title: "高效・全方位的後勤支援",
      desc: "致力為僱傭中介與僱主提供高效、全方位的後勤支援——從實證為本的篩選外傭方法、貼心的接機與健康驗身、住宿安排，到扎實的技能與培訓，協助僱傭中心省卻後勤煩惱，專注前線業務，輕鬆起航。",
    },
    valuesEyebrow: "核心價值",
    valuesTitle: "三大核心價值，支撐每一份托付",
    valueLabel: (n: number) => `核心價值 0${n}`,
    values: [
      {
        title: "高效專業",
        desc: "運用標準化與數位化流程，AI 協助僱主省卻時間；全方位以數據為本，精準核對履歷，深入了解個人能力與性格。",
      },
      {
        title: "誠信嚴謹",
        desc: "支援工作嚴格把關，重視溝通與承諾。由接機、驗身、簡介會到培訓全方位支援，上門服務，務求一步到位。",
      },
      {
        title: "溫暖賦能",
        desc: "不僅提供後勤服務，更連結不同中介公司，促進資訊發放與交流，讓僱傭服務更具支援、更有人情味。",
      },
    ],
  },
  cta: {
    eyebrow: "開始使用",
    title: "後勤就緒，準備起航",
    subtitle: "開戶只需一個驗證碼。登入後即可購買套票、提交預約，讓我們為您的僱傭中心處理一切後勤安排。",
    bookNow: "立即預約服務",
    login: "登入 / 註冊賬戶",
    imgAlt: "環環相扣的品牌插畫",
  },
  footer: {
    tagline: "連結僱主與工人，一站式服務安排——陪同驗身、工人接機、AI 視頻面試。",
    quickLinks: "快速連結",
    booking: "服務預約",
    account: "賬號中心",
    interview: "AI 視頻面試",
    contact: "聯絡",
    rights: "版權所有。",
  },
};

export type Messages = typeof yue;

const cmn: Messages = {
  header: {
    nav: {
      services: "服务项目",
      process: "服务流程",
      interview: "AI 面试",
      about: "关于我们",
    },
    login: "登录 / 注册",
    bookNow: "立即预约",
    account: "账号中心",
    logout: "退出登录",
    logoutTitle: "退出登录？",
    logoutHint: "退出后需要重新验证邮箱或手机号才能再次登录。",
    cancel: "取消",
    confirmLogout: "确认退出",
    openMenu: "打开菜单",
    closeMenu: "关闭菜单",
    mainNav: "主导航",
    mobileNav: "移动端导航",
    language: "语言",
  },
  hero: {
    badge: "NEXUSLINK SERVICES LIMITED",
    title1: "前线交给你，",
    title2: "后勤交给我。",
    subtitle: "全方位支援雇佣中心，助您业务轻松起航——网上提交预约，专人确认跟进，订单状态全程透明。",
    ctaBook: "立即预约服务",
    ctaServices: "了解服务项目",
    trust: ["套票制透明收费", "订单全程可跟进", "邮箱 + 短信双通道登录", "专人确认安排"],
    imgAlt: "两个人通过流线与节点彼此连结的品牌插画",
  },
  services: {
    eyebrow: "服务项目",
    title: "工人服务・一站办妥",
    subtitle: "从工人抵达第一刻开始，接机、验身、入户跟进，每项服务都有专人对接，雇主全程掌握进度。",
    perTime: "/ 次",
    pack: (price: number) => `10 次套票 HK$${price}`,
    bookNow: "立即预约",
    items: {
      medical: {
        label: "陪同验身",
        description: "专人陪同工人到指定诊所进行验身，协助登记及沟通。",
        includes: ["专人陪同往返诊所", "协助登记及文件处理", "即时向雇主汇报结果"],
      },
      pickup: {
        label: "工人接机",
        description: "专人在香港国际机场接工人，安全送达指定地点。",
        includes: ["航班动态实时跟踪", "接机并送达指定地址", "即时向雇主报平安"],
      },
      combo: {
        label: "验身 + 接机",
        description: "接机与陪同验身一并安排，工人到埠后流程无缝衔接。",
        includes: ["航班动态实时跟踪", "接机并陪同验身", "送达指定地址", "即时向雇主汇报"],
      },
      "full-pack": {
        label: "全部打包服务",
        description: "接机、验身、入户跟进等一站式安排，全程专人跟进。",
        includes: ["航班动态实时跟踪", "接机并陪同验身", "送达指定地址", "入户跟进及后续支援"],
      },
    },
  },
  process: {
    eyebrow: "服务流程",
    title: "四步・完成预约",
    subtitle: "流程简单直接，一环扣一环，每一步都有迹可循。",
    stepLabel: (n: number) => `第 ${n} 步`,
    steps: [
      {
        title: "注册 / 登录",
        desc: "邮箱或手机短信验证码登录，首次登录即自动开户，两种方式可互相绑定。",
      },
      {
        title: "购买套票",
        desc: "按需购买单次或 10 次套票，收费透明，余额随时在账户内查看。",
      },
      {
        title: "提交预约",
        desc: "选择服务、填写工人资料并上传文件，30 秒完成提交。",
      },
      {
        title: "专人确认跟进",
        desc: "我们确认后以邮件通知您，订单状态在账户内实时更新。",
      },
    ],
  },
  interview: {
    eyebrow: "AI 视频面试",
    title: "面试评估・交给 AI 先过一遍",
    subtitle: "为合作机构而设的后台评估工具：创建面试、发送专属链接给工人，AI 自动完成转写与评估，机构在后台查看逐题结果与整体报告。",
    imgAlt: "手机视频面试的品牌插画",
    features: [
      {
        title: "视频作答",
        desc: "工人通过专属链接逐题录制作答，无需下载任何应用。",
      },
      {
        title: "AI 语音转写",
        desc: "自动将作答内容转写为文字，支持广东话口音。",
      },
      {
        title: "逐题评估 + 整体报告",
        desc: "AI 按考察要点逐题判断，并输出整体评估报告供参考。",
      },
    ],
    note: "目前仅于管理后台开放给合作机构，暂不对个人用户开放。",
  },
  about: {
    eyebrow: "关于我们",
    title: "以品质成就信赖，与雇佣中心并肩同行",
    subtitle: (brand: string) =>
      `${brand} 专注外佣后勤支援，把接机、验身、住宿、培训等繁琐环节逐一办妥，让雇佣中心专注前线业务，无后顾之忧。`,
    vision: {
      eyebrow: "愿景",
      title: "外佣后勤支援枢纽",
      desc: "成为亚太区最具信赖与创新力的外佣后勤支援枢纽，重新定义业界标准，让每一份跨国信任都稳固而温暖。",
    },
    mission: {
      eyebrow: "使命",
      title: "高效・全方位的后勤支援",
      desc: "致力于为雇佣中介与雇主提供高效、全方位的后勤支援——从实证为本的筛选外佣方法、贴心的接机与健康验身、住宿安排，到扎实的技能与培训，协助雇佣中心省却后勤烦恼，专注前线业务，轻松起航。",
    },
    valuesEyebrow: "核心价值",
    valuesTitle: "三大核心价值，支撑每一份托付",
    valueLabel: (n: number) => `核心价值 0${n}`,
    values: [
      {
        title: "高效专业",
        desc: "运用标准化与数字化流程，AI 协助雇主节省时间；全方位以数据为本，精准核对简历，深入了解个人能力与性格。",
      },
      {
        title: "诚信严谨",
        desc: "支援工作严格把关，重视沟通与承诺。由接机、验身、简介会到培训全方位支援，上门服务，务求一步到位。",
      },
      {
        title: "温暖赋能",
        desc: "不仅提供后勤服务，更连接不同中介公司，促进资讯发放与交流，让雇佣服务更具支援、更有人情味。",
      },
    ],
  },
  cta: {
    eyebrow: "开始使用",
    title: "后勤就绪，准备起航",
    subtitle: "开户只需一个验证码。登录后即可购买套票、提交预约，让我们为您的雇佣中心处理一切后勤安排。",
    bookNow: "立即预约服务",
    login: "登录 / 注册账户",
    imgAlt: "环环相扣的品牌插画",
  },
  footer: {
    tagline: "连接雇主与工人，一站式服务安排——陪同验身、工人接机、AI 视频面试。",
    quickLinks: "快速链接",
    booking: "服务预约",
    account: "账号中心",
    interview: "AI 视频面试",
    contact: "联系方式",
    rights: "版权所有。",
  },
};

const en: Messages = {
  header: {
    nav: {
      services: "Services",
      process: "How it works",
      interview: "AI Interview",
      about: "About us",
    },
    login: "Log in / Sign up",
    bookNow: "Book now",
    account: "Account",
    logout: "Log out",
    logoutTitle: "Log out?",
    logoutHint: "After logging out, you'll need to verify your email or phone number again to log back in.",
    cancel: "Cancel",
    confirmLogout: "Confirm log out",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    mainNav: "Main navigation",
    mobileNav: "Mobile navigation",
    language: "Language",
  },
  hero: {
    badge: "NEXUSLINK SERVICES LIMITED",
    title1: "You run the front line.",
    title2: "We handle the back office.",
    subtitle:
      "End-to-end support for employment agencies—book online, get personal confirmation and follow-up, and track every order with full transparency.",
    ctaBook: "Book a service now",
    ctaServices: "Explore services",
    trust: [
      "Transparent pass-pack pricing",
      "Track every order end-to-end",
      "Log in via email or SMS",
      "Personal confirmation & follow-up",
    ],
    imgAlt: "Brand illustration of two people connected by flowing lines and nodes",
  },
  services: {
    eyebrow: "Services",
    title: "Helper services, all in one place",
    subtitle:
      "From the moment your helper arrives—airport pickup, medical check-ups and home settling-in—every service comes with a dedicated coordinator, and employers stay informed throughout.",
    perTime: "/ session",
    pack: (price: number) => `10-session pack HK$${price}`,
    bookNow: "Book now",
    items: {
      medical: {
        label: "Accompanied medical exam",
        description: "Our staff accompany your helper to the designated clinic, assisting with registration and communication.",
        includes: [
          "Dedicated escort to and from the clinic",
          "Assistance with registration and paperwork",
          "Instant result updates to the employer",
        ],
      },
      pickup: {
        label: "Helper airport pickup",
        description: "Our staff meet your helper at Hong Kong International Airport and deliver them safely to the designated location.",
        includes: [
          "Real-time flight tracking",
          "Airport pickup and door-to-door delivery",
          "Instant safe-arrival notice to the employer",
        ],
      },
      combo: {
        label: "Medical exam + pickup",
        description: "Airport pickup and the accompanied medical exam arranged together, so the process flows seamlessly after arrival.",
        includes: [
          "Real-time flight tracking",
          "Pickup with accompanied medical exam",
          "Delivery to the designated address",
          "Instant updates to the employer",
        ],
      },
      "full-pack": {
        label: "Full package",
        description: "One-stop arrangements covering pickup, medical exam and home settling-in, with a dedicated coordinator throughout.",
        includes: [
          "Real-time flight tracking",
          "Pickup with accompanied medical exam",
          "Delivery to the designated address",
          "Home settling-in and follow-up support",
        ],
      },
    },
  },
  process: {
    eyebrow: "How it works",
    title: "Four steps to a completed booking",
    subtitle: "A simple, straightforward process where every step leaves a clear trail.",
    stepLabel: (n: number) => `STEP ${n}`,
    steps: [
      {
        title: "Sign up / Log in",
        desc: "Log in with an email or SMS verification code—your account is created automatically on first login, and both methods can be linked.",
      },
      {
        title: "Buy a pass pack",
        desc: "Purchase single sessions or a 10-session pack as needed. Pricing is transparent and your balance is always visible in your account.",
      },
      {
        title: "Submit a booking",
        desc: "Choose a service, fill in your helper's details and upload documents—submission takes 30 seconds.",
      },
      {
        title: "Confirmation & follow-up",
        desc: "Once confirmed, we notify you by email and your order status updates in real time in your account.",
      },
    ],
  },
  interview: {
    eyebrow: "AI video interview",
    title: "Let AI screen the interview first",
    subtitle:
      "A back-office assessment tool built for partner agencies: create an interview, send a private link to the helper, and let AI handle transcription and evaluation—then review per-question results and an overall report in the admin console.",
    imgAlt: "Brand illustration of a video interview on a phone",
    features: [
      {
        title: "Video answers",
        desc: "Helpers record video answers question by question via a private link—no app download required.",
      },
      {
        title: "AI transcription",
        desc: "Answers are automatically transcribed into text, with support for Cantonese accents.",
      },
      {
        title: "Per-question review + overall report",
        desc: "AI assesses each answer against the evaluation criteria and produces an overall report for your reference.",
      },
    ],
    note: "Currently available to partner agencies via the admin console only; not yet open to individual users.",
  },
  about: {
    eyebrow: "About us",
    title: "Building trust through quality, standing with employment agencies",
    subtitle: (brand: string) =>
      `${brand} focuses on domestic-helper back-office support—taking care of the tedious steps from airport pickup, medical check-ups and accommodation to training—so employment agencies can focus on their front-line business with complete peace of mind.`,
    vision: {
      eyebrow: "VISION",
      title: "The hub for domestic-helper support",
      desc: "To become the most trusted and innovative domestic-helper back-office hub in Asia-Pacific, redefining industry standards and making every cross-border bond solid and warm.",
    },
    mission: {
      eyebrow: "MISSION",
      title: "Efficient, end-to-end back-office support",
      desc: "We are dedicated to providing employment agencies and employers with efficient, end-to-end back-office support—from evidence-based helper screening and attentive airport pickup and medical check-ups to accommodation and solid skills training—so agencies can skip the logistics worries, focus on their front-line business and set sail with ease.",
    },
    valuesEyebrow: "VALUES",
    valuesTitle: "Three core values behind every trust placed in us",
    valueLabel: (n: number) => `VALUE 0${n}`,
    values: [
      {
        title: "Efficiency & Professionalism",
        desc: "With standardized and digitized workflows and AI-assisted screening, we save employers time. Data-driven throughout, we verify CVs precisely and understand each candidate's ability and personality in depth.",
      },
      {
        title: "Integrity & Rigor",
        desc: "We hold our support work to strict standards and value communication and commitment. From pickup and medical check-ups to briefings and training, we provide full on-site support—getting everything right in one go.",
      },
      {
        title: "Care & Empowerment",
        desc: "Beyond back-office services, we connect different agencies and facilitate information sharing and exchange—making employment services better supported and more human.",
      },
    ],
  },
  cta: {
    eyebrow: "Get started",
    title: "Back office ready. Ready to set sail.",
    subtitle:
      "Opening an account takes just one verification code. Once logged in, you can buy pass packs and submit bookings—let us handle all the back-office arrangements for your employment agency.",
    bookNow: "Book a service now",
    login: "Log in / Sign up",
    imgAlt: "Brand illustration of interlocking rings",
  },
  footer: {
    tagline:
      "Connecting employers and helpers with one-stop arrangements—accompanied medical exams, helper airport pickup and AI video interviews.",
    quickLinks: "Quick links",
    booking: "Book a service",
    account: "Account",
    interview: "AI video interview",
    contact: "Contact",
    rights: "All rights reserved.",
  },
};

export const DICTIONARIES: Record<LocaleKey, Messages> = { yue, cmn, en };
