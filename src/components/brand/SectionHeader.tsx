"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { REVEAL_EASE } from "@/lib/brand";

/**
 * 區塊標題（簡約版）：小標籤 + 大標題 + 副文案，居中。
 * 無編號、無裝飾線。
 */
export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  /** 標題上方的小標籤（可選） */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  const centered = align === "center";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: REVEAL_EASE }}
      className={`mb-12 sm:mb-14 ${centered ? "mx-auto text-center" : "text-left"}`}
    >
      {eyebrow && (
        <p className="mb-3 text-[12px] font-bold tracking-[0.18em] text-[#35a07a]">
          {eyebrow.toUpperCase()}
        </p>
      )}
      <h2
        className="text-[#161b2e]"
        style={
          {
            fontSize: "clamp(28px, 3.6vw, 42px)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1.18,
            textWrap: "balance",
          } as CSSProperties
        }
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`mt-4 max-w-[600px] text-[14px] leading-[1.85] text-[#5d6b85] sm:text-[15px] ${
            centered ? "mx-auto" : ""
          }`}
        >
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}
