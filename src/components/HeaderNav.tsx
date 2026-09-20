"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "服務預約", href: "/booking" },
  { label: "管理後台", href: "/admin" },
];

export default function HeaderNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 漢堡按鈕：<992px 顯示 */}
      <button
        type="button"
        className={`site-nav-toggle${open ? " open" : ""}`}
        aria-expanded={open}
        aria-label={open ? "關閉主選單" : "開啟主選單"}
        onClick={() => setOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>
      <ul className={`site-navbar-nav${open ? " open" : ""}`}>
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/booking"
              ? pathname.startsWith("/booking")
              : pathname.startsWith(item.href);
          return (
            <li key={item.label} className={active ? "active" : ""}>
              <a href={item.href}>{item.label}</a>
            </li>
          );
        })}
      </ul>
    </>
  );
}
