import type { Metadata } from "next";
import BookingForm from "./BookingForm";

export const metadata: Metadata = {
  title: "服務預約：工人驗身、接機、一站式打包安排",
  description:
    "網上預約陪同驗身、工人接機或全部打包服務，提交資料後專人確認並電郵通知。立即預約，流程透明簡單。",
};

export default function BookingPage() {
  return (
    <div className="blog-page">
      <div className="blog-header">
        <h1 className="blog-header-title">服務預約</h1>
      </div>
      <div className="blog-section">
        <div className="booking-card">
          <BookingForm />
        </div>
      </div>
    </div>
  );
}
