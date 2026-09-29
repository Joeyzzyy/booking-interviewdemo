"use client";

import { ArrowRight, Ticket, ShieldCheck, MessagesSquare, UserCheck } from "lucide-react";
import AuthGatedLink from "@/components/auth/AuthGatedLink";
import { useLanguage } from "@/lib/i18n";

/**
 * Hero：簡約版——極淺底色 + 大字標題 + 兩個按鈕 + 一行信任指標。
 * 僅保留階梯淡入，無光斑、無裝飾線條。
 */
export default function HeroSection() {
  const { t } = useLanguage();
  const TRUST_ICONS = [Ticket, ShieldCheck, MessagesSquare, UserCheck];

  return (
    <section
      className="relative flex items-center justify-center px-6 pt-24 pb-20 text-center sm:px-10 sm:pt-32 sm:pb-28"
      style={{ background: "linear-gradient(180deg, #f8f9fc 0%, #ffffff 100%)" }}
    >
      <div className="mx-auto w-full max-w-4xl">
        <p
          className="hero-in mx-auto inline-flex items-center gap-2 rounded-full border border-[#e6e9f2] bg-white px-4 py-1.5 text-[11px] font-semibold tracking-[0.16em] text-[#35a07a]"
          style={{ animationDelay: "0.05s" }}
        >
          {t.hero.badge}
        </p>

        <h1
          className="hero-in mx-auto mt-7 text-[#161b2e]"
          style={{
            fontSize: "clamp(40px, 6.5vw, 76px)",
            fontWeight: 600,
            letterSpacing: "-0.03em",
            lineHeight: 1.12,
            animationDelay: "0.15s",
          }}
        >
          {t.hero.title1}
          <span className="block text-[#35a07a]">{t.hero.title2}</span>
        </h1>

        <p
          className="hero-in mx-auto mt-6 max-w-xl text-[15px] leading-[1.9] text-[#5d6b85] sm:text-[16px]"
          style={{ animationDelay: "0.25s" }}
        >
          {t.hero.subtitle}
        </p>

        <div
          className="hero-in mt-10 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "0.35s" }}
        >
          <AuthGatedLink
            href="/booking"
            className="btn-primary inline-flex items-center gap-2 rounded-full bg-[#35a07a] px-8 py-3.5 text-[14.5px] font-bold text-white shadow-[0_8px_20px_rgba(53,160,122,0.25)]"
          >
            {t.hero.ctaBook}
            <ArrowRight size={16} aria-hidden="true" />
          </AuthGatedLink>
          <a
            href="#services"
            className="inline-flex items-center rounded-full border border-[#e6e9f2] bg-white px-8 py-3.5 text-[14.5px] font-semibold text-[#161b2e] transition-colors hover:border-[#35a07a]/50 hover:text-[#2a8163]"
          >
            {t.hero.ctaServices}
          </a>
        </div>

        <div
          className="hero-in mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[12.5px] font-semibold text-[#8b95ad]"
          style={{ animationDelay: "0.45s" }}
        >
          {t.hero.trust.map((item, i) => {
            const Icon = TRUST_ICONS[i];
            return (
              <span key={item} className="inline-flex items-center gap-2">
                <Icon size={14} className="text-[#35a07a]" aria-hidden="true" />
                {item}
              </span>
            );
          })}
        </div>

        {/* 品牌插畫：連結 */}
        <div className="hero-in mx-auto mt-14 max-w-[680px]" style={{ animationDelay: "0.55s" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/illustrations/hero-link.webp"
            alt={t.hero.imgAlt}
            className="mx-auto w-full"
            width={1200}
            height={675}
            loading="eager"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}
