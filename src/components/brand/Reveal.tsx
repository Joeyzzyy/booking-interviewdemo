"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { REVEAL_EASE } from "@/lib/brand";

/** 滾動 reveal 容器：進入視口時小幅上移淡入（克制幅度） */
export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** 階梯延遲（秒） */
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: REVEAL_EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
