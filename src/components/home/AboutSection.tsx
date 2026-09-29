"use client";

import { Compass, Target, Rocket, ShieldCheck, HeartHandshake } from "lucide-react";
import SectionHeader from "@/components/brand/SectionHeader";
import Reveal from "@/components/brand/Reveal";
import { brand } from "@/lib/brand";
import { useLanguage } from "@/lib/i18n";

const VALUE_ICONS = [Rocket, ShieldCheck, HeartHandshake] as const;

/** 關於我們：品牌口號 + 願景 / 使命 / 核心價值（簡約版） */
export default function AboutSection() {
  const { t } = useLanguage();

  return (
    <section id="about" className="bg-[#f8f9fc] px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeader
          eyebrow={t.about.eyebrow}
          title={t.about.title}
          subtitle={t.about.subtitle(brand.nameFull)}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Reveal delay={0.05}>
            <div className="card flex h-full flex-col gap-4 p-7 sm:p-9">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#e9f5f0] text-[#35a07a]">
                <Compass size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[12px] font-bold tracking-[0.18em] text-[#35a07a]">{t.about.vision.eyebrow}</p>
                <h3 className="mt-2 text-[19px] font-bold text-[#161b2e]">{t.about.vision.title}</h3>
              </div>
              <p className="text-[14px] leading-[1.9] text-[#5d6b85]">{t.about.vision.desc}</p>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="card flex h-full flex-col gap-4 p-7 sm:p-9">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#e9f5f0] text-[#35a07a]">
                <Target size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[12px] font-bold tracking-[0.18em] text-[#35a07a]">{t.about.mission.eyebrow}</p>
                <h3 className="mt-2 text-[19px] font-bold text-[#161b2e]">{t.about.mission.title}</h3>
              </div>
              <p className="text-[14px] leading-[1.9] text-[#5d6b85]">{t.about.mission.desc}</p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.18}>
          <p className="mt-16 text-center text-[12px] font-bold tracking-[0.18em] text-[#35a07a]">
            {t.about.valuesEyebrow}
          </p>
          <h3 className="mt-2 text-center text-[clamp(24px,3vw,32px)] font-semibold leading-[1.3] text-[#161b2e]">
            {t.about.valuesTitle}
          </h3>
        </Reveal>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {t.about.values.map((value, index) => {
            const Icon = VALUE_ICONS[index];
            return (
              <Reveal key={value.title} delay={0.22 + index * 0.07}>
                <div className="card flex h-full flex-col gap-4 p-7">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#e9f5f0] text-[#35a07a]">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[12px] font-bold tracking-[0.18em] text-[#35a07a]">
                      {t.about.valueLabel(index + 1)}
                    </p>
                    <h4 className="mt-2 text-[19px] font-bold text-[#161b2e]">{value.title}</h4>
                  </div>
                  <p className="text-[14px] leading-[1.9] text-[#5d6b85]">{value.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
