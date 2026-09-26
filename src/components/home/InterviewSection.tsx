import { Video, FileSearch, ClipboardList, Sparkles } from "lucide-react";
import SectionHeader from "@/components/brand/SectionHeader";
import Reveal from "@/components/brand/Reveal";

const FEATURES = [
  {
    icon: Video,
    title: "視頻作答",
    desc: "工人透過專屬連結逐題錄影作答，無需下載任何 App。",
  },
  {
    icon: FileSearch,
    title: "AI 語音轉寫",
    desc: "自動將作答內容轉寫為文字，支持廣東話口音。",
  },
  {
    icon: ClipboardList,
    title: "逐題評估 + 整體報告",
    desc: "AI 按考察要點逐題判斷，並輸出整體評估報告供參考。",
  },
] as const;

/** AI 視頻面試（簡約版）：白底 + 左文右卡的樸素排版 */
export default function InterviewSection() {
  return (
    <section id="interview" className="px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeader
          eyebrow="AI 視頻面試"
          title="面試評估・交給 AI 先過一遍"
          subtitle="為合作機構而設的後台評估工具：建立面試、發送專屬連結給工人，AI 自動完成轉寫與評估，機構在後台查看逐題結果與整體報告。"
        />

        <Reveal delay={0.05}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/illustrations/ai-interview.webp"
            alt="手機視頻面試的品牌插畫"
            className="mx-auto mb-14 w-full max-w-[460px]"
            width={1000}
            height={750}
            loading="lazy"
            decoding="async"
          />
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <div className="card flex h-full flex-col gap-3 p-6">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#e9f5f0] text-[#35a07a]">
                  <f.icon size={20} aria-hidden="true" />
                </span>
                <h3 className="text-[16px] font-bold text-[#161b2e]">{f.title}</h3>
                <p className="text-[13.5px] leading-[1.75] text-[#5d6b85]">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-[12.5px] font-semibold text-[#8b95ad]">
            <Sparkles size={14} className="text-[#35a07a]" aria-hidden="true" />
            目前僅於管理後台開放給合作機構，暫不對個人用戶開放。
          </p>
        </Reveal>
      </div>
    </section>
  );
}
