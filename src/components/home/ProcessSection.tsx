"use client";

import { UserPlus, Ticket, Send, PhoneCall } from "lucide-react";
import SectionHeader from "@/components/brand/SectionHeader";
import Reveal from "@/components/brand/Reveal";
import { useLanguage } from "@/lib/i18n";

const STEP_ICONS = [UserPlus, Ticket, Send, PhoneCall] as const;

/** 服務流程（簡約版）：四步，淺灰底 + 細連線 */
export default function ProcessSection() {
  const { t } = useLanguage();

  return (
    <section id="process" className="bg-[#f8f9fc] px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeader
          eyebrow={t.process.eyebrow}
          title={t.process.title}
          subtitle={t.process.subtitle}
        />

        <div className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* 桌面：步驟間細連線 */}
          <div className="absolute top-7 right-[12%] left-[12%] hidden h-px bg-[#e6e9f2] lg:block" aria-hidden="true" />
          {t.process.steps.map((step, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <Reveal key={step.title} delay={i * 0.08}>
                <div className="relative flex flex-col items-center text-center">
                  <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-[#e6e9f2] bg-white text-[#35a07a]">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <p className="mt-4 font-mono text-[11px] font-bold tracking-[0.2em] text-[#8b95ad]">
                    {t.process.stepLabel(i + 1)}
                  </p>
                  <h3 className="mt-2 text-[16px] font-bold text-[#161b2e]">{step.title}</h3>
                  <p className="mt-2 max-w-[250px] text-[13px] leading-[1.8] text-[#5d6b85]">{step.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
