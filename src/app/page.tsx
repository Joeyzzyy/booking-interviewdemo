import type { Metadata } from "next";
import HeroSection from "@/components/home/HeroSection";
import ServicesSection from "@/components/home/ServicesSection";
import ProcessSection from "@/components/home/ProcessSection";
import InterviewSection from "@/components/home/InterviewSection";
import AboutSection from "@/components/home/AboutSection";
import CTASection from "@/components/home/CTASection";
import SiteHeader from "@/components/brand/SiteHeader";

export const metadata: Metadata = {
  title: "NEXUSLINK | 連結僱主與工人・一站式服務安排",
  description:
    "NEXUSLINK SERVICES LIMITED——陪同驗身、工人接機、一站式打包安排，網上預約專人跟進；AI 視頻面試為合作機構而設。電郵或短訊驗證碼即開戶。",
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
    </>
  );
}
