"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

/** 表單項通用底框（圓角 xl + 淺邊框 + 品牌綠 focus 描邊）
 *  移動端 16px 字號：避免 iOS 聚焦時自動放大頁面 */
const FIELD_BASE =
  "w-full rounded-xl border border-black/[0.08] bg-white px-4 py-3 text-[16px] text-[#161b2e] outline-none transition-colors placeholder:text-[#8b95ad] focus:border-[#35a07a]/40 disabled:opacity-60 sm:text-[14px]";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 傳入左側 icon 時自動留出內邊距 */
  icon?: ReactNode;
}

/** 單行文本輸入框 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, className, ...rest },
  ref,
) {
  if (!icon) {
    return <input ref={ref} className={cn(FIELD_BASE, className)} {...rest} />;
  }
  return (
    <div className={cn("relative flex items-center", className)}>
      <span className="pointer-events-none absolute left-4 text-[#8b95ad]">{icon}</span>
      <input ref={ref} className={cn(FIELD_BASE, "pl-11")} {...rest} />
    </div>
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** 多行文本域 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cn(FIELD_BASE, "min-h-[96px] resize-y", className)} {...rest} />;
});

export interface FieldProps {
  /** 標籤文本 */
  label?: ReactNode;
  /** 錯誤文案（紅色顯示，優先級高於 hint） */
  error?: string;
  /** 提示文案（灰色顯示） */
  hint?: string;
  htmlFor?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** 表單字段組合：label + 控件 + error/hint，統一排布與配色 */
export function Field({ label, error, hint, htmlFor, required, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label !== undefined && (
        <label htmlFor={htmlFor} className="text-[12px] font-semibold text-[#161b2e]">
          {label}
          {required && <span className="ml-0.5 text-[#2a8163]">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-[11px] leading-[1.8] text-[#8b95ad]">{hint}</p>
      ) : null}
    </div>
  );
}
