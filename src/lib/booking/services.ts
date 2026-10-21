/**
 * 服務預約：服務項配置（前後台共用，保持單一數據源）。
 *
 * 價格按業務價目表（HKD）：
 *   接機 $300（只設 11:00 / 15:00 兩個接機時段）、驗身+接機 $550、
 *   上門 Settlement $1000（車費另計）、印尼護士上門培訓 $500/小時起、
 *   On Job Training $700/小時（4 小時起計）、Boarding House $100/晚。
 */

export interface ServiceField {
  key: string;
  label: string;
  type: "text" | "date" | "datetime-local" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  /** type 為 select 時的可選值（後端校驗只接受這些值） */
  options?: string[];
}

export interface ServiceItem {
  key: string;
  label: string;
  description: string;
  /** 包含項目說明（詳情展示用） */
  includes: string[];
  /** 單次價格（HKD；1 張套票 = 1 次/1 單位服務） */
  priceHkd: number;
  /** 計價單位鍵（對應 i18n services.units；缺省顯示「/ 次」） */
  priceUnit?: "perHourFrom" | "perHourMin4" | "perNight";
  /** 服務專屬欄位（通用聯絡欄位之外） */
  fields: ServiceField[];
}

/** 接機欄位（有 flightNo 即視為接機類服務：機票/行程單必傳） */
const PICKUP_FIELDS: ServiceField[] = [
  {
    key: "flightNo",
    label: "航班編號",
    type: "text",
    required: true,
    placeholder: "例如：CX906",
  },
  {
    key: "arrivalDate",
    label: "抵達日期",
    type: "date",
    required: true,
  },
  {
    key: "pickupTime",
    label: "接機時間",
    type: "select",
    required: true,
    placeholder: "請選擇接機時段",
    options: ["上午 11:00", "下午 3:00"],
  },
];

/** 驗身欄位（陪同驗身類服務附加） */
const MEDICAL_FIELDS: ServiceField[] = [
  {
    key: "medicalDate",
    label: "期望驗身日期",
    type: "date",
    required: true,
  },
  {
    key: "medicalArea",
    label: "診所 / 地區偏好",
    type: "text",
    placeholder: "例如：旺角、灣仔指定診所",
  },
];

/** 培訓欄位（上門培訓類服務共用） */
const TRAINING_FIELDS: ServiceField[] = [
  {
    key: "trainDate",
    label: "期望培訓日期",
    type: "date",
    required: true,
  },
  {
    key: "trainTopic",
    label: "培訓內容",
    type: "text",
    placeholder: "例如：照顧嬰兒、煮中餐",
  },
];

export const SERVICES: ServiceItem[] = [
  {
    key: "pickup",
    label: "工人接機",
    description: "專人於香港國際機場接工人，安全送達指定地點。接機時段只設上午 11:00 及下午 3:00 兩個選擇。",
    includes: ["航班動態實時跟蹤", "接機並送達指定地址", "即時向僱主報平安", "接機時段 11:00 / 15:00 二選一"],
    priceHkd: 300,
    fields: PICKUP_FIELDS,
  },
  {
    key: "combo",
    label: "驗身 + 接機",
    description: "接機與陪同驗身一併安排，工人到埗後流程無縫銜接；驗身報告經 WhatsApp 發送。",
    includes: ["航班動態實時跟蹤", "接機並陪同驗身", "送達指定地址", "驗身報告經 WhatsApp 發送"],
    priceHkd: 550,
    fields: [...PICKUP_FIELDS, ...MEDICAL_FIELDS],
  },
  {
    key: "settlement",
    label: "上門 Settlement（接走姐姐）",
    description: "專人上門辦理工人 settlement 手續並接走姐姐，車費另計。",
    includes: ["專人上門辦理手續", "協助 settlement 文件處理", "接走姐姐並安全送達", "車費另計"],
    priceHkd: 1000,
    fields: [
      {
        key: "settleDate",
        label: "上門日期",
        type: "date",
        required: true,
      },
      {
        key: "settleAddress",
        label: "上門地址",
        type: "text",
        required: true,
        placeholder: "例如：九龍塘 XX 道 X 號",
      },
    ],
  },
  {
    key: "nurse-training",
    label: "印尼護士上門培訓",
    description: "印尼籍護士上門為工人提供專業培訓，每小時 $500 或以上，視乎培訓內容而定。",
    includes: ["印尼籍護士上門", "按需求定制培訓內容", "每小時 $500 或以上"],
    priceHkd: 500,
    priceUnit: "perHourFrom",
    fields: TRAINING_FIELDS,
  },
  {
    key: "onjob-training",
    label: "On Job Training（煮飯 / 清潔）",
    description: "到戶實操培訓，涵蓋煮飯、清潔等日常家務；以 4 小時為起計單位。",
    includes: ["到戶實操指導", "煮飯 / 清潔等家務技能", "4 小時起計"],
    priceHkd: 700,
    priceUnit: "perHourMin4",
    fields: TRAINING_FIELDS,
  },
  {
    key: "boarding",
    label: "Boarding House（工人宿舍）",
    description: "工人到埗前後的短期宿舍安排，按晚收費，靈活彈性。",
    includes: ["安全衛生住宿環境", "按晚收費，靈活安排"],
    priceHkd: 100,
    priceUnit: "perNight",
    fields: [
      {
        key: "checkinDate",
        label: "入住日期",
        type: "date",
        required: true,
      },
      {
        key: "checkoutDate",
        label: "退房日期",
        type: "date",
        required: true,
      },
    ],
  },
];

export function getService(key: string): ServiceItem | undefined {
  return SERVICES.find((s) => s.key === key);
}

/** 上傳限制（前後端共用）
 *  注意：檔案經 Vercel Function 中轉，請求體上限約 4.5MB，
 *  因此以「所有檔案合計 ≤4MB」為硬上限（留 0.5MB 給表單開銷）。 */
export const UPLOAD_LIMITS = {
  maxFiles: 5,
  maxFileSize: 4 * 1024 * 1024, // 單個 4MB
  maxTotalSize: 4 * 1024 * 1024, // 合計 4MB
  accept: ".jpg,.jpeg,.png,.pdf",
  acceptMime: ["image/jpeg", "image/png", "application/pdf"],
} as const;
