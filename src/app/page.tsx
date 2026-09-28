import type { Metadata } from "next";
import HeroSection from "@/components/home/HeroSection";
import ServicesSection from "@/components/home/ServicesSection";
import ProcessSection from "@/components/home/ProcessSection";
import InterviewSection from "@/components/home/InterviewSection";
import AboutSection from "@/components/home/AboutSection";
import CTASection from "@/components/home/CTASection";
import SiteHeader from "@/components/brand/SiteHeader";
import SiteFooter from "@/components/brand/SiteFooter";

export const metadata: Metadata = {
  title: "NEXUSLINK | 前線交給你，後勤交給我・全方位支援僱傭中心",
  description:
    "NEXUSLINK SERVICES LIMITED——前線交給你，後勤交給我。全方位支援僱傭中心：實證為本的外傭篩選、接機、健康驗身、住宿安排與技能培訓，助您業務輕鬆起航；AI 視頻面試為合作機構而設。",
};

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <HeroSection />
        <ServicesSection />
        <ProcessSection />
        <InterviewSection />
        <AboutSection />
        <CTASection />
      </main>
      <SiteFooter />
    </>
  );
}
