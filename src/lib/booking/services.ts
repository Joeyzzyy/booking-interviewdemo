/**
 * 服務預約：服務項配置（前後端共用，保持單一數據源）。
 *
 * ★ 價格為占位值（HKD），上線前請按實際收費修改 priceHkd。
 *   priceHkd 為 null 時前端顯示「面議」。
 */

export interface ServiceField {
  key: string;
  label: string;
  type: "text" | "date" | "datetime-local" | "textarea";
  required?: boolean;
  placeholder?: string;
}

export interface ServiceItem {
  key: string;
  label: string;
  description: string;
  /** 包含項目說明（詳情展示用） */
  includes: string[];
  /** ★ 套票價格（HKD，占位值，上線前請按實際收費修改） */
  priceSingle: number;
  pricePack10: number;
  /** 服務專屬欄位（通用聯絡欄位之外） */
  fields: ServiceField[];
}

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

const PICKUP_FIELDS: ServiceField[] = [
  {
    key: "flightNo",
    label: "航班編號",
    type: "text",
    required: true,
    placeholder: "例如：CX906",
  },
  {
    key: "arrivalTime",
    label: "抵達日期及時間",
    type: "datetime-local",
    required: true,
  },
];

export const SERVICES: ServiceItem[] = [
  {
    key: "medical",
    label: "陪同驗身",
    description: "專人陪同工人到指定診所進行驗身，協助登記及溝通。",
    includes: ["專人陪同往返診所", "協助登記及文件處理", "即時向僱主匯報結果"],
    priceSingle: 600, // ★ 占位
    pricePack10: 5200, // ★ 占位
    fields: MEDICAL_FIELDS,
  },
  {
    key: "pickup",
    label: "工人接機",
    description: "專人於香港國際機場接工人，安全送達指定地點。",
    includes: ["航班動態實時跟蹤", "接機並送達指定地址", "即時向僱主報平安"],
    priceSingle: 800, // ★ 占位
    pricePack10: 7000, // ★ 占位
    fields: PICKUP_FIELDS,
  },
  {
    key: "combo",
    label: "驗身 + 接機",
    description: "接機與陪同驗身一併安排，工人到埗後流程無縫銜接。",
    includes: ["航班動態實時跟蹤", "接機並陪同驗身", "送達指定地址", "即時向僱主匯報"],
    priceSingle: 1200, // ★ 占位
    pricePack10: 10000, // ★ 占位
    fields: [...PICKUP_FIELDS, ...MEDICAL_FIELDS],
  },
  {
    key: "full-pack",
    label: "全部打包服務",
    description: "接機、驗身、入屋跟進等一站式安排，全程專人跟進。",
    includes: [
      "航班動態實時跟蹤",
      "接機並陪同驗身",
      "送達指定地址",
      "入屋跟進及後續支援",
    ],
    priceSingle: 2000, // ★ 占位
    pricePack10: 17000, // ★ 占位
    fields: [...PICKUP_FIELDS, ...MEDICAL_FIELDS],
  },
];

export function getService(key: string): ServiceItem | undefined {
  return SERVICES.find((s) => s.key === key);
}

/** 套票購買選項 */
export const PASS_PACKS = [
  { quantity: 1, label: "單張套票", priceKey: "priceSingle" as const },
  { quantity: 10, label: "10 張套票", priceKey: "pricePack10" as const },
];

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
