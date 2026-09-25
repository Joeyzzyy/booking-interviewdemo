"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * GlassGlow：給 .glass-card 子樹掛指針跟隨高光——
 * 監聽卡片自身的 pointermove，把指針位置寫入 --glass-x / --glass-y。
 */
export default function GlassGlow({
  children,
  className,
  radius,
}: {
  children: ReactNode;
  className?: string;
  /** 卡片圓角（覆蓋 --glass-radius，默認 24px） */
  radius?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--glass-x", `${(((e.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
      el.style.setProperty("--glass-y", `${(((e.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      className={`glass-card${className ? ` ${className}` : ""}`}
      style={radius ? ({ "--glass-radius": `${radius}px` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
