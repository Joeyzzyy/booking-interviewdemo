import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "預約成功",
  robots: { index: false },
};

export default function BookingSuccessPage() {
  return (
    <div className="booking-page">
      <header className="booking-topbar">
        <Link href="/booking" className="site-logo-text">
          Booking<span className="site-logo-accent">Demo</span>
        </Link>
      </header>
      <div className="booking-hero">
        <h1>服務預約</h1>
      </div>
      <div className="booking-body">
        <div className="booking-card">
          <div className="booking-success">
            <div className="booking-success-icon">✓</div>
            <h2>多謝你嘅預約</h2>
            <p>我哋會盡快確認你嘅訂單，並以電郵通知你。</p>
            <Link className="booking-submit" href="/booking">
              返回預約主頁
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
