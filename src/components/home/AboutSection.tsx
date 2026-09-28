import { Compass, Target } from "lucide-react";
import SectionHeader from "@/components/brand/SectionHeader";
import Reveal from "@/components/brand/Reveal";
import { brand } from "@/lib/brand";

/** 關於我們：品牌口號 + 願景 / 使命（簡約版） */
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
                我們致力於為僱傭中介與僱主提供高效、全方位的後勤支援——從實證為本的外傭篩選方法、貼心的接機與健康驗身、住宿安排，到扎實的技能培訓，協助僱傭中心省卻後勤煩惱，專注前線業務，輕鬆起航。
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
