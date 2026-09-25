"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "./cn";

export interface ModalProps {
  open: boolean;
  /** 標題（顯示在頭部，可省略） */
  title?: ReactNode;
  /** 底部操作區插槽（如確認/取消按鈕組） */
  footer?: ReactNode;
  /** 面板最大寬度類名 */
  widthClassName?: string;
  onClose: () => void;
  className?: string;
  children?: ReactNode;
}

/** 居中彈窗：AnimatePresence 淡入縮放，支持 ESC / 點擊遮罩關閉 */
export function Modal({ open, title, footer, widthClassName = "max-w-[420px]", onClose, className, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ scale: 0.94, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 16 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={cn("w-full rounded-2xl bg-white p-7 shadow-2xl", widthClassName, className)}
            onClick={(e) => e.stopPropagation()}
          >
            {title !== undefined && (
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-[17px] font-semibold text-[#161b2e]">{title}</h3>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="關閉"
                  className="cursor-pointer rounded-full border border-black/[0.08] p-1.5 text-[#8b95ad] transition-colors hover:text-[#161b2e]"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            )}
            {children}
            {footer !== undefined && <div className="mt-6 flex items-center justify-end gap-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
