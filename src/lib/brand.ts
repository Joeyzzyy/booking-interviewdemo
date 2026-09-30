/** 傭易做 / NEXUSLINK — 品牌常量（中文名：傭易做；英文名：NEXUSLINK） */

export const brand = {
  name: "NEXUSLINK",
  nameFull: "NEXUSLINK SERVICES LIMITED",
  nameCn: "傭易做",
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

/**
 * 按界面語言取品牌名：
 * 粵語 / 普通話（yue、cmn、zh*）顯示「傭易做」，英文及其他語言顯示 NEXUSLINK。
 */
export function brandName(locale: string): string {
  return /^(yue|cmn|zh)/i.test(locale) ? brand.nameCn : brand.name;
}
