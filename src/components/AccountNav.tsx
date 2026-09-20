"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 頂條登入狀態：已登入顯示郵箱 + 登出（彈窗確認），未登入顯示登入入口。
 * 監聽 window「op-auth-changed」事件，與 /booking 登入面板狀態同步。
 */
export default function AccountNav() {
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setEmail(data.customer?.email || null);
    } catch {
      /* 忽略，保持未登入態 */
    } finally {
      setChecked(true);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener("op-auth-changed", onChange);
    return () => window.removeEventListener("op-auth-changed", onChange);
  }, [refresh]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const logout = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setEmail(null);
      setConfirming(false);
      window.dispatchEvent(new Event("op-auth-changed"));
    } finally {
      setBusy(false);
    }
  };

  // 首次檢查完成前不渲染，避免登入態閃爍
  if (!checked) return null;

  // 試運行階段：未登入不在頂條透出登入入口（/booking 路徑直達）
  if (!email) return null;

  return (
    <>
      <span className="top-menu2-account">
        <span className="top-menu2-email" title={email}>
          {email}
        </span>
        <button type="button" onClick={() => setConfirming(true)}>
          登出
        </button>
      </span>

      {confirming && (
        <div
          className="booking-modal-mask"
          onClick={() => !busy && setConfirming(false)}
        >
          <div
            className="booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="logout-dialog-title">登出賬號？</h3>
            <p>登出後需要重新用電郵驗證碼登入先可以預約服務。</p>
            <div className="booking-modal-actions">
              <button
                type="button"
                className="booking-modal-back"
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                返回
              </button>
              <button
                type="button"
                className="booking-modal-confirm"
                disabled={busy}
                onClick={logout}
              >
                {busy ? "登出中…" : "確定登出"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
