"use client";

import { useCallback, useRef, useState, type VideoHTMLAttributes } from "react";

/**
 * 視頻：自動截取第一幀作為封面（poster）。
 * - 同源（blob:）視頻一定可以截到；
 * - 跨域（Supabase signed URL）視頻嘗試以 anonymous CORS 載入截圖，
 *   失敗時降級靠瀏覽器 preload="metadata" 原生顯示首幀。
 */
export default function VideoWithCover(props: VideoHTMLAttributes<HTMLVideoElement>) {
  const [poster, setPoster] = useState<string | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);

  const capture = useCallback(() => {
    const v = videoRef.current;
    if (!v || poster) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth || 640;
      canvas.height = v.videoHeight || 360;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      setPoster(canvas.toDataURL("image/jpeg", 0.7));
    } catch {
      /* 跨域被 taint 或無可用幀時忽略，靠 preload 顯示 */
    }
  }, [poster]);

  return (
    <video
      {...props}
      ref={videoRef}
      crossOrigin={props.crossOrigin ?? "anonymous"}
      poster={poster}
      preload={props.preload ?? "metadata"}
      onLoadedData={(e) => {
        const v = e.currentTarget;
        // 部分瀏覽器 loadeddata 時首幀未解碼完成，seek 一小段再截
        const onSeeked = () => {
          v.removeEventListener("seeked", onSeeked);
          capture();
        };
        v.addEventListener("seeked", onSeeked);
        try {
          v.currentTime = Math.min(0.1, (v.duration || 1) / 10);
        } catch {
          capture();
        }
        props.onLoadedData?.(e);
      }}
    />
  );
}
