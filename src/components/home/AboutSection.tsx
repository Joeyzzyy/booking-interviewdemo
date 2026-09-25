import SectionHeader from "@/components/brand/SectionHeader";
import Reveal from "@/components/brand/Reveal";
import { brand } from "@/lib/brand";

const STATS = [
  { value: "4", unit: "項", label: "核心工人服務" },
  { value: "2", unit: "種", label: "登入方式（電郵 / 短訊）" },
  { value: "1", unit: "個", label: "賬戶管理全部預約" },
  { value: "30", unit: "日", label: "登入狀態保持" },
] as const;

/** 關於我們 + 數據（簡約版） */
export default function AboutSection() {
  return (
    <section id="about" className="bg-[#f8f9fc] px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeader
          eyebrow="關於我們"
          title="以「連結」為念"
          subtitle={`${brand.nameFull} 相信：好的服務來自好的連結。我們把僱主、工人與每一個服務環節連成一條清晰的鏈——資料透明、進度可查、事事有回應。`}
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.06}>
              <div className="card flex flex-col items-center px-6 py-8 text-center">
                <p className="text-[40px] leading-none font-bold text-[#35a07a]">
                  {s.value}
                  <span className="ml-1 text-[16px] font-bold">{s.unit}</span>
                </p>
                <p className="mt-3 text-[13px] font-semibold text-[#5d6b85]">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
