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
        {/* 頂條 — 黃底（.top-menu2） */}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/common/logo.png" alt="家壹僱傭中心" />
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
            <div className="site-footer-address-title">地址</div>
            <div className="site-footer-address">
              <span>
                九龍旺角彌敦道574-576號和富商業大廈1501室
                <br />
                Room 1501, 15/F, Wofoo Commercial Building,
                <br />
                No. 574-576 Nathan Road, Mong Kok, Kowloon
              </span>
            </div>
            <div className="site-footer-address">
              <span><a href="tel:85295223881">9522 3881</a></span>
            </div>
            <div className="site-footer-address">
              <span><a href="mailto:info@oneplusagency.com">info@oneplusagency.com</a></span>
            </div>
          </div>
          <div className="site-footer-logo">
            <div className="logo2">
              <Link href="/booking">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/common/logo-150.png" alt="家壹僱傭中心" height="50" style={{ height: 50, width: "auto" }} />
              </Link>
            </div>
            <div className="site-footer-license">
              香港職業介紹所
              <br />
              牌照號碼: 79911
            </div>
          </div>
        </div>
        <div className="site-footer-copyright">
          <p>© {new Date().getFullYear()} Oneplus Employment Agency. All rights reserved.</p>
        </div>
      </footer>
      <ScrollToTop />
    </>
  );
}
