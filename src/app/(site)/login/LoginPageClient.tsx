"use client";

import { useSearchParams } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";

/** 獨立登入頁（與彈窗共用同一套表單；主要作為深鏈回退） */
export default function LoginPageClient() {
  const params = useSearchParams();
  const next = params.get("next") || "/booking";
  return (
    <div className="flex flex-1 items-center justify-center bg-[#f8f9fc] px-6 py-16 sm:py-24">
      <div className="card w-full max-w-[440px] p-8 sm:p-10">
        <h1 className="text-[20px] font-bold text-[#161b2e]">登入 / 註冊</h1>
        <p className="mt-2 mb-6 text-[13px] leading-[1.8] text-[#5d6b85]">
          選擇一種方式取得 6 位驗證碼，首次登入即自動建立賬戶。
        </p>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
