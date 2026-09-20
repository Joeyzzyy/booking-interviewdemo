import Link from "next/link";
import ScrollToTop from "@/components/ScrollToTop";
import HeaderNav from "@/components/HeaderNav";
import AccountNav from "@/components/AccountNav";

/** demo 站點外殼：頂條 + 主導航 + footer（只保留預約/後台相關入口） */
export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <header>
        {/* 頂條 — 淺藍底（.top-menu2） */}
        <div className="top-menu2">
          <div className="site-container">
            <span className="top-menu2-spacer" />
            <AccountNav />
            <Link href="/admin" className="top-menu2-login">
              管理後台
            </Link>
          </div>
        </div>
        {/* 主導航（.navbar） */}
        <nav className="site-navbar">
          <div className="site-container site-navbar-inner">
            <Link className="site-navbar-brand" href="/booking">
              <span className="site-logo-text">
                Booking<span className="site-logo-accent">Demo</span>
              </span>
            </Link>
            <HeaderNav />
          </div>
        </nav>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
      <footer className="site-footer">
        <div className="site-container site-footer-grid">
          <div className="site-footer-link">
            <div><Link href="/booking">服務預約</Link></div>
            <div><Link href="/admin">管理後台</Link></div>
          </div>
          <div>
            <div className="site-footer-address-title">關於本項目</div>
            <div className="site-footer-address">
              <span>
                服務預約 + 視頻面試獨立演示項目
                <br />
                僅作功能演示用途，並非真實服務
              </span>
            </div>
          </div>
          <div className="site-footer-logo">
            <div className="logo2">
              <Link href="/booking">
                <span className="site-logo-text">
                  Booking<span className="site-logo-accent">Demo</span>
                </span>
              </Link>
            </div>
            <div className="site-footer-license">Demo Project</div>
          </div>
        </div>
        <div className="site-footer-copyright">
          <p>© {new Date().getFullYear()} Booking Demo. For demo purposes only.</p>
        </div>
      </footer>
      <ScrollToTop />
    </>
  );
}
