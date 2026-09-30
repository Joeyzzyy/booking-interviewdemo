import type { Metadata } from "next";
import LoginDialogProvider from "@/components/auth/LoginDialogProvider";
import { LanguageProvider } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "傭易做 | 連結僱主與工人・一站式服務安排",
    template: "%s | 傭易做",
  },
  description:
    "傭易做——陪同驗身、工人接機、一站式打包安排，網上預約專人跟進；AI 視頻面試為合作機構而設。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-HK" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <LanguageProvider>
          <LoginDialogProvider>{children}</LoginDialogProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
