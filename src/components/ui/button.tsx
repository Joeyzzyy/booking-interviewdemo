"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

/** Button 變體與尺寸（lighthare 風格：圓角膠囊 + 品牌漸變 + 毛玻璃次級） */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 加載態：顯示 spinner 並禁用點擊 */
  loading?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "btn-primary bg-gradient-to-br from-[#4cb896] to-[#2a9470] text-white shadow-[0_4px_14px_rgba(53,160,122,0.28)] hover:shadow-[0_8px_22px_rgba(53,160,122,0.38)]",
  secondary:
    "border border-black/[0.08] bg-white/70 text-[#5d6b85] backdrop-blur-md hover:border-[#35a07a]/30 hover:text-[#2a8163]",
  outline:
    "border border-[#35a07a]/35 text-[#2a8163] hover:border-[#35a07a]/60 hover:bg-[#35a07a]/5",
  ghost: "text-[#5d6b85] hover:bg-black/[0.03] hover:text-[#161b2e]",
  danger:
    "border border-red-500/30 bg-red-50 text-red-600 hover:border-red-500/50 hover:bg-red-100",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "gap-1.5 px-4 py-2 text-[12px]",
  md: "gap-2 px-5 py-2.5 text-[13px]",
  lg: "gap-2 px-6 py-3 text-sm",
};

/** 通用按鈕：品牌漸變主按鈕 / 毛玻璃次級 / 描邊 / 幽靈 / 危險，支持 loading 態 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-full font-semibold transition-all duration-300",
        "disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});
