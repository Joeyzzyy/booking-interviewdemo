import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "預約成功",
  robots: { index: false },
};

export default function BookingSuccessPage() {
  return (
    <div className="blog-page">
      <div className="blog-header">
        <h1 className="blog-header-title">服務預約</h1>
      </div>
      <div className="blog-section">
        <div className="booking-card">
          <div className="booking-success">
            <div className="booking-success-icon">✓</div>
            <h2>多謝你嘅預約</h2>
            <p>如需查詢訂單狀態，可 WhatsApp 9522 3881 聯絡我哋。</p>
            <Link className="booking-submit" href="/">
              返回主頁
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
