import { ArrowRight } from "lucide-react";
import SectionHeader from "@/components/brand/SectionHeader";
import Reveal from "@/components/brand/Reveal";
import AuthGatedLink from "@/components/auth/AuthGatedLink";
import LoginButton from "@/components/auth/LoginButton";

/** 最終 CTA（簡約版） */
export default function CTASection() {
  return (
    <section className="px-6 py-20 sm:px-10 sm:py-24">
      <div className="mx-auto max-w-[760px] text-center">
        <Reveal delay={0}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/illustrations/link-rings.webp"
            alt="環環相扣的品牌插畫"
            className="mx-auto mb-6 w-[130px] sm:w-[150px]"
            width={640}
            height={640}
            loading="lazy"
            decoding="async"
          />
        </Reveal>
        <SectionHeader
          eyebrow="開始使用"
          title="現在就連結起來"
          subtitle="開戶只需一個驗證碼。登入後即可購買套票、提交預約，並在賬號中心管理你的聯絡方式。"
        />

        <Reveal delay={0.08}>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <AuthGatedLink
              href="/booking"
              className="btn-primary inline-flex items-center gap-2 rounded-full bg-[#35a07a] px-9 py-3.5 text-[14.5px] font-bold text-white shadow-[0_8px_20px_rgba(53,160,122,0.25)]"
            >
              立即預約服務
              <ArrowRight size={16} aria-hidden="true" />
            </AuthGatedLink>
            <LoginButton className="inline-flex cursor-pointer items-center rounded-full border border-[#e6e9f2] bg-white px-9 py-3.5 text-[14.5px] font-semibold text-[#161b2e] transition-colors hover:border-[#35a07a]/50 hover:text-[#2a8163]">
              登入 / 註冊賬戶
            </LoginButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
