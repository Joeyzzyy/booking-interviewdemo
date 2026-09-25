import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "預約成功",
  robots: { index: false },
};

export default function BookingSuccessPage() {
  return (
    <div className="relative flex flex-1 items-center justify-center px-6 py-20">
      <div className="card relative w-full max-w-[520px] p-10 text-center">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#4cb896] to-[#2a9470] text-white shadow-[0_10px_30px_rgba(53,160,122,0.4)]">
          <CircleCheck size={30} aria-hidden="true" />
        </span>
        <h1 className="text-[22px] font-bold text-[#161b2e]">多謝你的預約</h1>
        <p className="mt-3 text-[14px] leading-[1.85] text-[#5d6b85]">
          我們會盡快確認你的訂單，並以你登記的聯絡方式通知你。
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/booking">
            <Button size="lg">返回預約主頁</Button>
          </Link>
          <Link href="/account">
            <Button variant="secondary" size="lg">
              賬號中心
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
