"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";

/** Tabs 視覺風格：pill=膠囊（默認）/ underline=下劃線 */
export type TabsVariant = "pill" | "underline";

export interface TabItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  /** 禁用（如功能尚未開放）：灰顯且不可點擊 */
  disabled?: boolean;
  /** 禁用時的提示（hover title） */
  disabledHint?: string;
}

export interface TabsProps {
  items: TabItem[];
  /** 受控當前 key */
  active: string;
  onChange: (key: string) => void;
  variant?: TabsVariant;
  className?: string;
}

/** 受控選項卡：膠囊（品牌漸變淺底）或下劃線兩種風格 */
export function Tabs({ items, active, onChange, variant = "pill", className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1",
        variant === "underline" && "gap-6 border-b border-black/[0.06]",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            title={item.disabled ? item.disabledHint : undefined}
            onClick={() => !item.disabled && onChange(item.key)}
            className={cn(
              "flex shrink-0 items-center gap-2 font-semibold transition-colors duration-200",
              item.disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
              variant === "pill"
                ? "rounded-xl px-4 py-2.5 text-[13px]"
                : "-mb-px border-b-2 px-1 py-2.5 text-[13px]",
              isActive && !item.disabled
                ? variant === "pill"
                  ? "bg-gradient-to-br from-[#4cb896]/12 to-[#2a9470]/12 text-[#2a8163]"
                  : "border-[#35a07a] text-[#2a8163]"
                : variant === "pill"
                  ? "text-[#5d6b85] hover:bg-black/[0.03] hover:text-[#161b2e]"
                  : "border-transparent text-[#5d6b85] hover:text-[#161b2e]",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
