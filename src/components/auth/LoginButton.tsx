"use client";

import type { ReactNode } from "react";
import { openLogin } from "./login-events";

/** 打開登入彈窗的按鈕（樣式由調用方決定） */
export default function LoginButton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <button type="button" className={className} onClick={() => openLogin()}>
      {children}
    </button>
  );
}
