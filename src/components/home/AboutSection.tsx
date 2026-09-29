import { Compass, Target, Rocket, ShieldCheck, HeartHandshake } from "lucide-react";
import SectionHeader from "@/components/brand/SectionHeader";
import Reveal from "@/components/brand/Reveal";
import { brand } from "@/lib/brand";

const VALUES = [
  {
    icon: Rocket,
    eyebrow: "VALUE 01",
    title: "高效專業",
    en: "Efficiency & Professionalism",
    desc: "運用標準化與數位化流程，AI 協助僱主省卻時間；全方位以數據為本，精準核對 CV，深入了解個人能力與性格。",
  },
  {
    icon: ShieldCheck,
    eyebrow: "VALUE 02",
    title: "誠信嚴謹",
    en: "Integrity & Rigor",
    desc: "支援工作嚴格把關，重視溝通與承諾。由接機、驗身、Briefing 到培訓全方位支援，上門服務，務求一步到位。",
  },
  {
    icon: HeartHandshake,
    eyebrow: "VALUE 03",
    title: "溫暖賦能",
    en: "Care & Empowerment",
    desc: "不僅提供後勤服務，更連結不同中介公司，促進資訊發放與交流，讓僱傭服務更具支援、更有人情味。",
  },
];

/** 關於我們：品牌口號 + 願景 / 使命 / 核心價值（簡約版） */
export default function AboutSection() {
  return (
    <section id="about" className="bg-[#f8f9fc] px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeader
          eyebrow="關於我們"
          title="以品質成就信賴，與僱傭中心並肩同行"
          subtitle={`${brand.nameFull} 專注外傭後勤支援，把接機、驗身、住宿、培訓等繁瑣環節逐一辦妥，讓僱傭中心專注前線業務，無後顧之憂。`}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Reveal delay={0.05}>
            <div className="card flex h-full flex-col gap-4 p-7 sm:p-9">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#e9f5f0] text-[#35a07a]">
                <Compass size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[12px] font-bold tracking-[0.18em] text-[#35a07a]">VISION｜願景</p>
                <h3 className="mt-2 text-[19px] font-bold text-[#161b2e]">外傭後勤支援樞紐</h3>
              </div>
              <p className="text-[14px] leading-[1.9] text-[#5d6b85]">
                成為亞太區最具信賴與創新力的外傭後勤支援樞紐，重新定義業界標準，讓每一份跨國信任都穩固而溫暖。
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="card flex h-full flex-col gap-4 p-7 sm:p-9">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#e9f5f0] text-[#35a07a]">
                <Target size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[12px] font-bold tracking-[0.18em] text-[#35a07a]">MISSION｜使命</p>
                <h3 className="mt-2 text-[19px] font-bold text-[#161b2e]">高效・全方位的後勤支援</h3>
              </div>
              <p className="text-[14px] leading-[1.9] text-[#5d6b85]">
                致力為僱傭中介與僱主提供高效、全方位的後勤支援——從實證為本的篩選外傭方法、貼心的接機與健康驗身、住宿安排，到扎實的技能與培訓，協助僱傭中心省卻後勤煩惱，專注前線業務，輕鬆起航。
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.18}>
          <p className="mt-16 text-center text-[12px] font-bold tracking-[0.18em] text-[#35a07a]">
            VALUES｜核心價值
          </p>
          <h3 className="mt-2 text-center text-[clamp(24px,3vw,32px)] font-semibold leading-[1.3] text-[#161b2e]">
            三大核心價值，支撐每一份托付
          </h3>
        </Reveal>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {VALUES.map((value, index) => (
            <Reveal key={value.title} delay={0.22 + index * 0.07}>
              <div className="card flex h-full flex-col gap-4 p-7">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#e9f5f0] text-[#35a07a]">
                  <value.icon size={20} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[12px] font-bold tracking-[0.18em] text-[#35a07a]">
                    {value.eyebrow}｜{value.en}
                  </p>
                  <h4 className="mt-2 text-[19px] font-bold text-[#161b2e]">{value.title}</h4>
                </div>
                <p className="text-[14px] leading-[1.9] text-[#5d6b85]">{value.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
