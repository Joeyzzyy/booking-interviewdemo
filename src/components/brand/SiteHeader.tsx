"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, UserRound, LogOut, ChevronDown } from "lucide-react";
import Logo from "./Logo";
import { openLogin } from "@/components/auth/login-events";

const NAV = [
  { href: "/#services", label: "服務項目" },
  { href: "/#process", label: "服務流程" },
  { href: "/#interview", label: "AI 面試" },
  { href: "/#about", label: "關於我們" },
] as const;

/** 站點頂部導航（簡約版）：固定白色細邊；登入後顯示郵箱，點擊展開下拉菜單（賬號中心 / 登出） */
export default function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setAccount(data.customer ? data.customer.email || data.customer.phone : null);
    } catch {
      setAccount(null);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    void loadMe();
    const onAuthChanged = () => void loadMe();
    window.addEventListener("nl-auth-changed", onAuthChanged);
    return () => window.removeEventListener("nl-auth-changed", onAuthChanged);
  }, [loadMe]);

  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  // 點擊外部 / ESC 關閉郵箱下拉菜單
  useEffect(() => {
    if (!userMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAccount(null);
    setUserMenuOpen(false);
    setMenuOpen(false);
    window.dispatchEvent(new Event("nl-auth-changed"));
  };

  /** 「立即預約」：未登入攔截並彈登入框 */
  const onBookClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (authChecked && !account) {
      e.preventDefault();
      setMenuOpen(false);
      openLogin();
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#e6e9f2] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-[64px] max-w-[1200px] items-center justify-between px-4 sm:px-8">
        <Link href="/" aria-label="NEXUSLINK 首頁" className="shrink-0">
          <Logo size={34} wordmarkSize={17} />
        </Link>

        {/* 桌面導航（僅未登入時顯示） */}
        {authChecked && !account && (
          <nav className="hidden items-center gap-1 md:flex" aria-label="主導航">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-[13.5px] font-semibold text-[#3d4763] transition-colors hover:text-[#2a8163]"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}

        <div className="hidden items-center gap-2.5 md:flex">
          {authChecked && account ? (
            <>
              {/* 郵箱 + 下拉菜單 */}
              <div ref={userMenuRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors ${
                    userMenuOpen
                      ? "border-[#35a07a]/40 text-[#2a8163]"
                      : "border-[#e6e9f2] text-[#3d4763] hover:border-[#35a07a]/40 hover:text-[#2a8163]"
                  }`}
                >
                  <UserRound size={14} aria-hidden="true" />
                  <span className="max-w-[180px] truncate">{account}</span>
                  <ChevronDown
                    size={13}
                    aria-hidden="true"
                    className={`shrink-0 transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      role="menu"
                      className="absolute right-0 top-full mt-2 w-[240px] overflow-hidden rounded-2xl border border-[#e6e9f2] bg-white py-2 shadow-[0_16px_40px_rgba(22,27,46,0.10)]"
                    >
                      <p className="truncate border-b border-[#f0f2f7] px-4 py-2.5 text-[12px] text-[#8b95ad]">
                        {account}
                      </p>
                      <Link
                        href="/account"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-[#3d4763] transition-colors hover:bg-[#f6f8fa] hover:text-[#2a8163]"
                      >
                        <UserRound size={14} aria-hidden="true" />
                        賬號中心
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void logout()}
                        className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-[#5d6b85] transition-colors hover:bg-[#f6f8fa] hover:text-red-600"
                      >
                        <LogOut size={14} aria-hidden="true" />
                        登出
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <Link
                href="/booking"
                onClick={onBookClick}
                className="btn-primary inline-flex items-center rounded-full bg-[#35a07a] px-5 py-2.5 text-[13px] font-bold text-white"
              >
                立即預約
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openLogin()}
                className="cursor-pointer rounded-full px-4 py-2 text-[13px] font-semibold text-[#3d4763] transition-colors hover:text-[#2a8163]"
              >
                登入 / 註冊
              </button>
              <Link
                href="/booking"
                onClick={onBookClick}
                className="btn-primary inline-flex items-center rounded-full bg-[#35a07a] px-5 py-2.5 text-[13px] font-bold text-white"
              >
                立即預約
              </Link>
            </>
          )}
        </div>

        {/* 移動端菜單按鈕 */}
        <button
          type="button"
          aria-label={menuOpen ? "關閉菜單" : "打開菜單"}
          onClick={() => setMenuOpen((v) => !v)}
          className="cursor-pointer rounded-full p-2 text-[#161b2e] md:hidden"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* 移動端抽屜菜單 */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-[#e6e9f2] bg-white md:hidden"
            aria-label="移動端導航"
          >
            <div className="flex flex-col gap-1 px-5 py-4">
              {authChecked && !account &&
                NAV.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl px-4 py-3 text-[15px] font-semibold text-[#3d4763] hover:bg-black/[0.03]"
                  >
                    {item.label}
                  </a>
                ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-[#e6e9f2] pt-4">
                {authChecked && account ? (
                  <>
                    <p className="flex items-center gap-2 truncate px-4 py-1.5 text-[12.5px] font-semibold text-[#8b95ad]">
                      <UserRound size={14} aria-hidden="true" className="shrink-0" />
                      {account}
                    </p>
                    <Link
                      href="/account"
                      onClick={() => setMenuOpen(false)}
                      className="rounded-xl border border-[#e6e9f2] px-4 py-3 text-center text-[14px] font-semibold text-[#3d4763]"
                    >
                      賬號中心
                    </Link>
                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="cursor-pointer rounded-xl px-4 py-3 text-[14px] font-semibold text-[#8b95ad]"
                    >
                      登出
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      openLogin();
                    }}
                    className="cursor-pointer rounded-xl border border-[#e6e9f2] px-4 py-3 text-center text-[14px] font-semibold text-[#3d4763]"
                  >
                    登入 / 註冊
                  </button>
                )}
                <Link
                  href="/booking"
                  onClick={onBookClick}
                  className="rounded-xl bg-[#35a07a] px-4 py-3 text-center text-[14px] font-bold text-white"
                >
                  立即預約
                </Link>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
