"use client";

import { Video, FileSearch, ClipboardList, Sparkles } from "lucide-react";
import SectionHeader from "@/components/brand/SectionHeader";
import Reveal from "@/components/brand/Reveal";
import { useLanguage } from "@/lib/i18n";

const FEATURE_ICONS = [Video, FileSearch, ClipboardList] as const;

/** AI 視頻面試（簡約版）：白底 + 左文右卡的樸素排版 */
export default function InterviewSection() {
  const { t } = useLanguage();

  return (
    <section id="interview" className="px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeader
          eyebrow={t.interview.eyebrow}
          title={t.interview.title}
          subtitle={t.interview.subtitle}
        />

        <Reveal delay={0.05}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/illustrations/ai-interview.webp"
            alt={t.interview.imgAlt}
            className="mx-auto mb-14 w-full max-w-[460px]"
            width={1000}
            height={750}
            loading="lazy"
            decoding="async"
          />
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-3">
          {t.interview.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <Reveal key={f.title} delay={i * 0.06}>
                <div className="card flex h-full flex-col gap-3 p-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#e9f5f0] text-[#35a07a]">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="text-[16px] font-bold text-[#161b2e]">{f.title}</h3>
                  <p className="text-[13.5px] leading-[1.75] text-[#5d6b85]">{f.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-[12.5px] font-semibold text-[#8b95ad]">
            <Sparkles size={14} className="text-[#35a07a]" aria-hidden="true" />
            {t.interview.note}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
