/** NEXUSLINK SERVICES LIMITED — 品牌常量 */

export const brand = {
  name: "NEXUSLINK",
  nameFull: "NEXUSLINK SERVICES LIMITED",
  nameCn: "連悅服務",
  tagline: "連結僱主與工人・一站式服務安排",
  taglineEn: "Linking People, Connecting Care",
  /** 品牌漸變：靛藍 → 青 */
  gradientFrom: "#4cb896",
  gradientTo: "#2a9470",
  /** 淺底點綴色（需要更高對比度時用深靛） */
  accent: "#35a07a",
  accentDeep: "#2a8163",
} as const;

export const contact = {
  email: "hello@nexuslink.services",
  phone: "+852 0000 0000",
} as const;

/** 滾動 reveal 統一參數（對齊 lighthare：0.85s cubic-bezier(.18,.7,.2,1)） */
export const REVEAL_EASE = [0.18, 0.7, 0.2, 1] as const;
