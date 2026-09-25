"use client";

import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { openLogin } from "./login-events";

/**
 * 需登入的鏈接：已登入正常跳轉；未登入攔截跳轉並在當前頁彈出登入框。
 */
export default function AuthGatedLink({
  href = "/booking",
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  const check = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      const ok = Boolean(data.customer);
      setLoggedIn(ok);
      return ok;
    } catch {
      setLoggedIn(false);
      return false;
    }
  }, []);

  useEffect(() => {
    void check();
    const onAuthChanged = () => void check();
    window.addEventListener("nl-auth-changed", onAuthChanged);
    return () => window.removeEventListener("nl-auth-changed", onAuthChanged);
  }, [check]);

  const onClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    if (loggedIn === true) return; // 已登入：正常跳轉
    e.preventDefault();
    const ok = loggedIn === null ? await check() : loggedIn;
    if (!ok) openLogin();
  };

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
