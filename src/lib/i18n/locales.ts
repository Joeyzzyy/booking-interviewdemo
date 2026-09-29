/** 網站語言：粵語（繁體・香港）/ 普通話（簡體）/ English */
export const LOCALES = [
  { key: "yue", label: "粵語", short: "繁", htmlLang: "zh-HK" },
  { key: "cmn", label: "普通话", short: "简", htmlLang: "zh-CN" },
  { key: "en", label: "English", short: "EN", htmlLang: "en" },
] as const;

export type LocaleKey = (typeof LOCALES)[number]["key"];

export const DEFAULT_LOCALE: LocaleKey = "yue";

export function isLocaleKey(value: string | null): value is LocaleKey {
  return value !== null && (LOCALES as readonly { key: string }[]).some((l) => l.key === value);
}
