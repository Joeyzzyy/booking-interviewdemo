import type { Metadata } from "next";
import Link from "next/link";
import BookingForm from "./BookingForm";

export const metadata: Metadata = {
  title: "服務預約：工人驗身、接機、一站式打包安排",
  description:
    "網上預約陪同驗身、工人接機或全部打包服務，提交資料後專人確認並電郵通知。立即預約，流程透明簡單。",
};

export default function BookingPage() {
  return (
    <div className="booking-page">
      <header className="booking-topbar">
        <Link href="/booking" className="site-logo-text">
          Booking<span className="site-logo-accent">Demo</span>
        </Link>
      </header>
      <div className="booking-hero">
        <h1>服務預約</h1>
        <p>陪同驗身、工人接機、一站式安排，網上提交，專人跟進。</p>
      </div>
      <div className="booking-body">
        <div className="booking-card">
          <BookingForm />
        </div>
      </div>
    </div>
  );
}
