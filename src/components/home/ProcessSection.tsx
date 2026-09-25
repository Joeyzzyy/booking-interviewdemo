import { UserPlus, Ticket, Send, PhoneCall } from "lucide-react";
import SectionHeader from "@/components/brand/SectionHeader";
import Reveal from "@/components/brand/Reveal";

const STEPS = [
  {
    icon: UserPlus,
    title: "註冊 / 登入",
    desc: "電郵或手機短訊驗證碼登入，首次登入即自動開戶，兩種方式可互相綁定。",
  },
  {
    icon: Ticket,
    title: "購買套票",
    desc: "按需購買單次或 10 次套票，收費透明，餘額隨時在賬戶內查看。",
  },
  {
    icon: Send,
    title: "提交預約",
    desc: "選擇服務、填寫工人資料並上傳文件，30 秒完成提交。",
  },
  {
    icon: PhoneCall,
    title: "專人確認跟進",
    desc: "我們確認後以電郵通知你，訂單狀態在賬戶內實時更新。",
  },
] as const;

/** 服務流程（簡約版）：四步，淺灰底 + 細連線 */
export default function ProcessSection() {
  return (
    <section id="process" className="bg-[#f8f9fc] px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeader
          eyebrow="服務流程"
          title="四步・完成預約"
          subtitle="流程簡單直接，一環扣一環，每一步都有跡可循。"
        />

        <div className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* 桌面：步驟間細連線 */}
          <div className="absolute top-7 right-[12%] left-[12%] hidden h-px bg-[#e6e9f2] lg:block" aria-hidden="true" />
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.08}>
              <div className="relative flex flex-col items-center text-center">
                <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-[#e6e9f2] bg-white text-[#35a07a]">
                  <step.icon size={22} aria-hidden="true" />
                </span>
                <p className="mt-4 font-mono text-[11px] font-bold tracking-[0.2em] text-[#8b95ad]">
                  STEP {i + 1}
                </p>
                <h3 className="mt-2 text-[16px] font-bold text-[#161b2e]">{step.title}</h3>
                <p className="mt-2 max-w-[250px] text-[13px] leading-[1.8] text-[#5d6b85]">{step.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
