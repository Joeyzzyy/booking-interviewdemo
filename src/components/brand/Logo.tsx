import { brand } from "@/lib/brand";

/**
 * NEXUSLINK logo：圓角方形綠色漸變底 + 白色「雙環相扣」圖形。
 * 僅顯示品牌名（無 slogan）。
 */
export default function Logo({
  size = 36,
  withWordmark = true,
  wordmarkSize = 20,
  wordmarkClass = "text-[#161b2e]",
  light = false,
}: {
  size?: number;
  withWordmark?: boolean;
  wordmarkSize?: number;
  wordmarkClass?: string;
  /** 深底上使用（wordmark 轉白） */
  light?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 96 96"
        role="img"
        aria-label={brand.name}
        className="shrink-0 drop-shadow-[0_4px_10px_rgba(53,160,122,0.28)]"
      >
        <defs>
          <linearGradient id="nl-logo-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={brand.gradientFrom} />
            <stop offset="100%" stopColor={brand.gradientTo} />
          </linearGradient>
        </defs>
        <rect width="96" height="96" rx="24" fill="url(#nl-logo-gradient)" />
        {/* 雙環相扣：左環在上、右環穿過左環（用白色底色段遮出「扣入」效果） */}
        <g fill="none" strokeLinecap="round">
          <circle cx="38" cy="48" r="17" stroke="#ffffff" strokeWidth="8" />
          <circle cx="58" cy="48" r="17" stroke="#ffffff" strokeWidth="8" strokeOpacity="0.92" />
          <path
            d="M 48.9 36.6 A 17 17 0 0 1 48.9 59.4"
            stroke={brand.gradientTo}
            strokeWidth="8.6"
            strokeOpacity="0.55"
          />
          <path d="M 48.9 36.6 A 17 17 0 0 1 48.9 59.4" stroke="#ffffff" strokeWidth="8" />
        </g>
      </svg>
      {withWordmark && (
        <span
          className={`font-extrabold ${light ? "text-white" : wordmarkClass}`}
          style={{ fontSize: wordmarkSize, letterSpacing: "0.02em" }}
        >
          {brand.name}
        </span>
      )}
    </span>
  );
}
