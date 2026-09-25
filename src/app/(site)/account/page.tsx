import type { Metadata } from "next";
import AccountClient from "./AccountClient";

export const metadata: Metadata = {
  title: "賬號中心",
  description: "管理你的 NEXUSLINK 賬戶：查看預約、綁定或解綁電郵與手機號。",
  robots: { index: false },
};

export default function AccountPage() {
  return <AccountClient />;
}
