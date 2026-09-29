"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_LOCALE, isLocaleKey, LOCALES, type LocaleKey } from "./locales";
import { DICTIONARIES, type Messages } from "./dictionaries";

const STORAGE_KEY = "nl-locale";

interface LanguageContextValue {
  locale: LocaleKey;
  setLocale: (locale: LocaleKey) => void;
  /** 當前語言的文案字典 */
  t: Messages;
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: DICTIONARIES[DEFAULT_LOCALE],
});

/**
 * 站點語言上下文（客戶端 i18n）：
 * 默認粵語；首次渲染與 SSR 一致，hydration 後從 localStorage 恢復並同步 <html lang>。
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleKey>(DEFAULT_LOCALE);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocaleKey(saved) && saved !== locale) {
      setLocaleState(saved);
    }
    // 僅在掛載時恢復一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const meta = LOCALES.find((l) => l.key === locale);
    if (meta) document.documentElement.lang = meta.htmlLang;
  }, [locale]);

  const setLocale = useCallback((next: LocaleKey) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: DICTIONARIES[locale] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
