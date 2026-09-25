"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/** Badge 顏色變體：綠=成功 / 琥珀=警告 / 紅=錯誤 / 灰=中性 / 品牌靛 */
export type BadgeVariant = "green" | "amber" | "red" | "gray" | "brand";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** 左側小圖標 */
  icon?: ReactNode;
}

const VARIANTS: Record<BadgeVariant, string> = {
  green: "border-emerald-500/25 bg-emerald-50 text-emerald-600",
  amber: "border-amber-500/30 bg-amber-50 text-amber-700",
  red: "border-red-500/25 bg-red-50 text-red-600",
  gray: "border-black/[0.08] bg-black/[0.03] text-[#5d6b85]",
  brand: "border-[#35a07a]/25 bg-gradient-to-br from-[#4cb896]/10 to-[#2a9470]/10 text-[#2a8163]",
};

/** 狀態徽章：圓角膠囊 + mono 大寫字母風格 */
export function Badge({ variant = "gray", icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] font-bold tracking-[0.08em] uppercase",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}
