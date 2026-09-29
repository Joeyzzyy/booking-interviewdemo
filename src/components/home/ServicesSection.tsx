"use client";

import { Stethoscope, Plane, CalendarCheck2, PackageCheck, ArrowRight, Check } from "lucide-react";
import AuthGatedLink from "@/components/auth/AuthGatedLink";
import SectionHeader from "@/components/brand/SectionHeader";
import Reveal from "@/components/brand/Reveal";
import { SERVICES } from "@/lib/booking/services";
import { useLanguage } from "@/lib/i18n";

const SERVICE_ICONS: Record<string, typeof Stethoscope> = {
  medical: Stethoscope,
  pickup: Plane,
  combo: CalendarCheck2,
  "full-pack": PackageCheck,
};

/** 服務項目（簡約版）：白卡 + 細邊框，僅保留必要信息 */
export default function ServicesSection() {
  const { t } = useLanguage();

  return (
    <section id="services" className="px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[1200px]">
        <SectionHeader
          eyebrow={t.services.eyebrow}
          title={t.services.title}
          subtitle={t.services.subtitle}
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s, i) => {
            const Icon = SERVICE_ICONS[s.key] || PackageCheck;
            const copy = t.services.items[s.key as keyof typeof t.services.items];
            return (
              <Reveal key={s.key} delay={i * 0.06} className="h-full">
                <div className="card flex h-full flex-col p-6">
                  <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#e9f5f0] text-[#35a07a]">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="text-[17px] font-bold text-[#161b2e]">{copy.label}</h3>
                  <p className="mt-2 text-[13.5px] leading-[1.75] text-[#5d6b85]">{copy.description}</p>
                  <ul className="mt-4 flex flex-col gap-1.5">
                    {copy.includes.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[12.5px] text-[#5d6b85]">
                        <Check size={13} className="mt-0.5 shrink-0 text-[#35a07a]" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-6">
                    <p className="text-[15px] font-bold text-[#35a07a]">
                      HK${s.priceSingle}
                      <span className="ml-1 text-[12px] font-semibold text-[#8b95ad]">{t.services.perTime}</span>
                      <span className="ml-2 text-[12px] font-semibold text-[#8b95ad]">
                        {t.services.pack(s.pricePack10)}
                      </span>
                    </p>
                    <AuthGatedLink
                      href="/booking"
                      className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#35a07a] hover:text-[#2a8163]"
                    >
                      {t.services.bookNow}
                      <ArrowRight size={14} aria-hidden="true" />
                    </AuthGatedLink>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
