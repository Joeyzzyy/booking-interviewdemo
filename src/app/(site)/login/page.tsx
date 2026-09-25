import type { Metadata } from "next";
import { Suspense } from "react";
import LoginPageClient from "./LoginPageClient";

export const metadata: Metadata = {
  title: "登入 / 註冊",
  description: "以電郵或手機短訊驗證碼登入 NEXUSLINK，首次登入即自動註冊。",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-[14px] text-[#8b95ad]">
          載入中…
        </div>
      }
    >
      <LoginPageClient />
    </Suspense>
  );
}
