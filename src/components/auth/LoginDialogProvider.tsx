"use client";

import { useEffect, useState, type ReactNode } from "react";
import LoginDialog from "./LoginDialog";

/**
 * 全局登入彈窗宿主：任何位置呼叫 openLogin(next) 即可彈出登入框。
 * 掛在根 layout，全站（含首頁）可用。
 */
export default function LoginDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState<string | undefined>(undefined);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ next?: string }>).detail;
      setNext(detail?.next);
      setOpen(true);
    };
    window.addEventListener("nl-open-login", onOpen);
    return () => window.removeEventListener("nl-open-login", onOpen);
  }, []);

  return (
    <>
      {children}
      <LoginDialog open={open} next={next} onClose={() => setOpen(false)} />
    </>
  );
}
