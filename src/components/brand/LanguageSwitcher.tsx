"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Globe } from "lucide-react";
import { LOCALES, useLanguage } from "@/lib/i18n";

/** 語言切換器：Globe 圖標 + 當前語言簡稱，點擊展開三語選項 */
export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.key === locale) ?? LOCALES[0];

  // 點擊外部 / ESC 關閉
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.header.language}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-semibold transition-colors ${
          open
            ? "border-[#35a07a]/40 text-[#2a8163]"
            : "border-[#e6e9f2] text-[#3d4763] hover:border-[#35a07a]/40 hover:text-[#2a8163]"
        }`}
      >
        <Globe size={14} aria-hidden="true" />
        <span>{current.short}</span>
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-[150px] overflow-hidden rounded-2xl border border-[#e6e9f2] bg-white py-1.5 shadow-[0_16px_40px_rgba(22,27,46,0.10)]"
          >
            {LOCALES.map((l) => (
              <button
                key={l.key}
                type="button"
                role="menuitemradio"
                aria-checked={l.key === locale}
                onClick={() => {
                  setLocale(l.key);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left text-[13px] font-semibold transition-colors hover:bg-[#f6f8fa] ${
                  l.key === locale ? "text-[#2a8163]" : "text-[#3d4763]"
                }`}
              >
                {l.label}
                {l.key === locale && <Check size={14} aria-hidden="true" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
