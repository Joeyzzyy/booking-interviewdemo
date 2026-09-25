import type { Metadata } from "next";
import BookingClient from "./BookingClient";

export const metadata: Metadata = {
  title: "服務預約",
  description:
    "網上預約陪同驗身、工人接機或全部打包服務，提交資料後專人確認並電郵通知。立即預約，流程透明簡單。",
};

export default function BookingPage() {
  return <BookingClient />;
}
