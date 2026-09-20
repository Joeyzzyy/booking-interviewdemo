"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SERVICES, UPLOAD_LIMITS, type ServiceItem } from "@/lib/booking/services";

type SubmitState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "success"; orderNo: string }
  | { phase: "error"; message: string };

interface MyBooking {
  id: string;
  order_no: string;
  service_label: string;
  price_hkd: number | null;
  worker_name: string;
  status: string;
  created_at: string;
}

interface PassBalance {
  serviceKey: string;
  total: number;
  used: number;
  remaining: number;
}

const MY_STATUS: Record<string, string> = {
  pending: "待確認",
  confirmed: "已確認",
  rejected: "未能安排",
  cancelled: "已取消",
};

/** 郵箱驗證碼登入面板（註冊/登入一體） */
function LoginPanel({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "發送失敗");
        return;
      }
      setCodeSent(true);
      if (data.devCode) setDevCode(data.devCode); // 開發模式：郵件未配置時直接顯示
    } catch {
      setError("網絡錯誤，請稍後再試");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "驗證失敗");
        return;
      }
      onLogin(data.customer.email);
    } catch {
      setError("網絡錯誤，請稍後再試");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="booking-login">
      <h2>登入 / 註冊</h2>
      <p className="booking-login-hint">
        預約服務需要先登入。輸入電郵獲取驗證碼，首次登入即自動註冊。
      </p>
      <form onSubmit={codeSent ? verify : (e) => { e.preventDefault(); void sendCode(); }}>
        <label className="booking-field">
          <span>電郵 *</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={codeSent}
            placeholder="確認通知會發到呢個郵箱"
          />
        </label>
        {codeSent && (
          <label className="booking-field">
            <span>驗證碼 *</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="6 位數字驗證碼"
              autoFocus
            />
          </label>
        )}
        {devCode && (
          <p className="booking-upload-hint">開發模式：驗證碼係 {devCode}（未配置郵件服務）</p>
        )}
        {error && <p className="booking-error">{error}</p>}
        <button type="submit" className="booking-submit" disabled={busy}>
          {busy ? "處理中…" : codeSent ? "登入" : "發送驗證碼"}
        </button>
        {codeSent && (
          <button
            type="button"
            className="booking-link-btn"
            onClick={() => {
              setCodeSent(false);
              setCode("");
              setDevCode("");
              setError("");
            }}
          >
            換一個電郵
          </button>
        )}
      </form>
    </div>
  );
}

export default function BookingForm() {
  const [account, setAccount] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [buying, setBuying] = useState<string | null>(null);
  const [purchaseMsg, setPurchaseMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<MyBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [waSame, setWaSame] = useState(true);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [serviceKey, setServiceKey] = useState<string>("");
  const [tab, setTab] = useState<"passes" | "buy" | "book">("book");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [state, setState] = useState<SubmitState>({ phase: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const service: ServiceItem | undefined = useMemo(
    () => SERVICES.find((s) => s.key === serviceKey),
    [serviceKey]
  );

  const loadMyBookings = async () => {
    try {
      const res = await fetch("/api/my/bookings", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMyBookings(data.bookings);
      }
    } catch {
      /* 列表失敗不影響下單 */
    }
  };

  const loadBalances = async () => {
    try {
      const res = await fetch("/api/my/passes", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, number> = {};
        for (const b of data.balances as PassBalance[]) map[b.serviceKey] = b.remaining;
        setBalances(map);
      }
    } catch {
      /* 忽略 */
    }
  };

  const buyPass = async (serviceKey: string, quantity: 1 | 10) => {
    const key = `${serviceKey}-${quantity}`;
    setBuying(key);
    setPurchaseMsg(null);
    try {
      const res = await fetch("/api/passes/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceKey, quantity }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPurchaseMsg({ ok: false, text: data.error || "創建付款失敗" });
        return;
      }
      window.location.assign(data.url); // 跳轉 Stripe 付款頁
    } catch {
      setPurchaseMsg({ ok: false, text: "網絡錯誤，請稍後再試" });
    } finally {
      setBuying(null);
    }
  };

  /** 演示用：領取試用套票（正式購票開通後接口自動停用） */
  const claimDemoPass = async () => {
    setBuying("demo");
    setPurchaseMsg(null);
    try {
      const res = await fetch("/api/passes/demo-buy", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setPurchaseMsg({ ok: false, text: data.error || "領取失敗" });
        return;
      }
      const map: Record<string, number> = {};
      for (const b of data.balances) map[b.serviceKey] = b.remaining;
      setBalances(map);
      setPurchaseMsg({ ok: true, text: "試用套票已入賬：每種服務 2 張，即刻可預約。" });
    } catch {
      setPurchaseMsg({ ok: false, text: "網絡錯誤，請稍後再試" });
    } finally {
      setBuying(null);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.customer) {
          setAccount(data.customer.email);
          await Promise.all([loadMyBookings(), loadBalances()]);
        }
        // Stripe 付款回跳提示
        const q = new URLSearchParams(window.location.search).get("purchase");
        if (q === "success") {
          setPurchaseMsg({ ok: true, text: "付款成功，套票已入賬你的賬戶。" });
          window.history.replaceState(null, "", "/booking");
        } else if (q === "cancelled") {
          setPurchaseMsg({ ok: false, text: "付款已取消，套票未扣費。" });
          window.history.replaceState(null, "", "/booking");
        }
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  const cancelBooking = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch(`/api/my/bookings/${cancelTarget.id}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error || "取消失敗");
        return;
      }
      setCancelTarget(null);
      await Promise.all([loadMyBookings(), loadBalances()]);
    } catch {
      setCancelError("網絡錯誤，請稍後再試");
    } finally {
      setCancelling(false);
    }
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setAccount(null);
      setMyBookings([]);
      setState({ phase: "idle" });
      setLogoutConfirm(false);
      window.dispatchEvent(new Event("op-auth-changed"));
    } finally {
      setLoggingOut(false);
    }
  };

  const onPickFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, UPLOAD_LIMITS.maxFiles);
    const oversized = next.find((f) => f.size > UPLOAD_LIMITS.maxFileSize);
    if (oversized) {
      setUploadError(`「${oversized.name}」超過 4MB，請壓縮或截圖後再上傳`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const total = next.reduce((sum, f) => sum + f.size, 0);
    if (total > UPLOAD_LIMITS.maxTotalSize) {
      setUploadError("所有檔案合計不能超過 4MB，請減少或壓縮檔案");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploadError("");
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!service) return;
    if (files.length === 0) {
      setState({ phase: "error", message: "請上傳工人資料（簽證、護照或機票行程單）" });
      return;
    }
    setState({ phase: "submitting" });

    const form = new FormData(e.currentTarget);
    form.set("serviceKey", service.key);
    if (waSame) form.set("whatsapp", (form.get("phone") as string) || "");
    for (const f of files) form.append("files", f);

    try {
      const res = await fetch("/api/bookings", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setState({ phase: "error", message: data.error || "提交失敗，請稍後再試" });
        return;
      }
      setState({ phase: "success", orderNo: data.orderNo });
      await Promise.all([loadMyBookings(), loadBalances()]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setState({ phase: "error", message: "網絡錯誤，請稍後再試" });
    }
  };

  if (!authChecked) {
    return <p className="booking-upload-hint">載入中…</p>;
  }

  if (!account) {
    return (
      <LoginPanel
        onLogin={(email) => {
          setAccount(email);
          void loadMyBookings();
          void loadBalances();
          window.dispatchEvent(new Event("op-auth-changed"));
        }}
      />
    );
  }

  if (state.phase === "success") {
    return (
      <div className="booking-success">
        <div className="booking-success-icon">✓</div>
        <h2>預約已提交</h2>
        <p>
          你嘅訂單編號係 <strong>{state.orderNo}</strong>。
          我哋確認後會以電郵通知你（{account}），請留意收件箱。
        </p>
        <button
          type="button"
          className="booking-submit"
          onClick={() => {
            setState({ phase: "idle" });
            setServiceKey("");
            setFiles([]);
          }}
        >
          再次預約
        </button>
      </div>
    );
  }

  return (
    <>
      {/* 賬號欄 */}
      <div className="booking-account">
        <span>
          已登入：<strong>{account}</strong>
        </span>
        <button type="button" className="booking-link-btn" onClick={() => setLogoutConfirm(true)}>
          登出
        </button>
      </div>

      {/* 功能分頁 */}
      <div className="booking-tabs" role="tablist" aria-label="預約功能分頁">
        {(
          [
            { key: "passes", label: "我嘅套票" },
            { key: "buy", label: "購買套票" },
            { key: "book", label: "發起預約" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 我嘅套票（餘額 + 我嘅預約） */}
      {tab === "passes" && (
        <div className="booking-passes">
          <h2 className="booking-step-title">我嘅套票</h2>
          <div className="booking-pass-grid">
            {SERVICES.map((s) => {
              const remaining = balances[s.key] || 0;
              return (
                <div key={s.key} className="booking-pass-card">
                  <div className="booking-pass-head">
                    <strong>{s.label}</strong>
                    <span className={`booking-pass-remaining${remaining > 0 ? " has" : ""}`}>
                      剩餘 {remaining} 次
                    </span>
                  </div>
                  <div className="booking-pass-buy">
                    <button type="button" onClick={() => setTab("buy")}>
                      去購買
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 我嘅預約 */}
          {myBookings.length > 0 ? (
            <div className="booking-mine">
              <h2 className="booking-step-title">我嘅預約</h2>
              <ul>
                {myBookings.map((b) => (
                  <li key={b.order_no}>
                    <span className="booking-mine-no">{b.order_no}</span>
                    <span>{b.service_label}</span>
                    <span>{b.worker_name}</span>
                    <span className={`admin-status admin-status-${b.status}`}>
                      {MY_STATUS[b.status] || b.status}
                    </span>
                    <span className="booking-mine-time">
                      {new Date(b.created_at).toLocaleDateString("zh-HK")}
                    </span>
                    {b.status === "pending" && (
                      <button
                        type="button"
                        className="booking-cancel-btn"
                        onClick={() => setCancelTarget(b)}
                      >
                        取消
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="booking-upload-hint">暫時未有預約記錄。</p>
          )}
        </div>
      )}

      {/* 購買套票 */}
      {tab === "buy" && (
        <div className="booking-passes">
          <div className="booking-passes-head">
            <h2 className="booking-step-title">購買套票</h2>
            <button
              type="button"
              className="booking-demo-btn"
              disabled={buying !== null}
              onClick={claimDemoPass}
            >
              {buying === "demo" ? "領取中…" : "領取試用套票（演示）"}
            </button>
          </div>
          {purchaseMsg && (
            <p className={purchaseMsg.ok ? "booking-pass-ok" : "booking-error"}>
              {purchaseMsg.text}
            </p>
          )}
          <div className="booking-pass-grid">
            {SERVICES.map((s) => (
              <div key={s.key} className="booking-pass-card">
                <div className="booking-pass-head">
                  <strong>{s.label}</strong>
                  <span className="booking-pass-remaining">
                    HK${s.priceSingle}/次
                  </span>
                </div>
                <div className="booking-pass-buy">
                  <button
                    type="button"
                    disabled={buying !== null}
                    onClick={() => buyPass(s.key, 1)}
                  >
                    {buying === `${s.key}-1` ? "跳轉中…" : `買 1 張 HK$${s.priceSingle}`}
                  </button>
                  <button
                    type="button"
                    className="booking-pass-pack"
                    disabled={buying !== null}
                    onClick={() => buyPass(s.key, 10)}
                  >
                    {buying === `${s.key}-10` ? "跳轉中…" : `買 10 張 HK$${s.pricePack10}`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "book" && (
      <form onSubmit={onSubmit} className="booking-form">
        {/* 1. 選擇服務 */}
        <h2 className="booking-step-title">1. 選擇服務</h2>
        <div className="booking-services">
          {SERVICES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`booking-service-card${serviceKey === s.key ? " selected" : ""}`}
              onClick={() => setServiceKey(s.key)}
              aria-pressed={serviceKey === s.key}
            >
              <span className="booking-service-label">
                {s.label}
                <span className={`booking-service-remain${(balances[s.key] || 0) > 0 ? " has" : ""}`}>
                  {(balances[s.key] || 0) > 0 ? `剩餘 ${balances[s.key]} 次` : "未購買套票"}
                </span>
              </span>
              <span className="booking-service-desc">{s.description}</span>
              <span className="booking-service-price">HK${s.priceSingle}/次</span>
            </button>
          ))}
        </div>

        {service && (
          <>
            <div className="booking-includes">
              <strong>{service.label}包括：</strong>
              <ul>
                {service.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            {/* 無餘額：不可填寫資料，引導購票/領試用 */}
            {(balances[service.key] || 0) === 0 ? (
              <div className="booking-no-balance">
                <p>
                  你未購買「{service.label}」套票，暫時不能填寫預約資料。
                  請先到「購買套票」分頁購買，或領取試用套票體驗流程。
                </p>
                <button
                  type="button"
                  className="booking-submit"
                  onClick={() => setTab("buy")}
                >
                  前往購買套票
                </button>
              </div>
            ) : (
              <>
                {/* 2. 填寫資料 */}
            <h2 className="booking-step-title">2. 填寫資料</h2>
            <div className="booking-grid">
              <label className="booking-field">
                <span>僱主姓名 *</span>
                <input name="employerName" type="text" required />
              </label>
              <label className="booking-field">
                <span>聯絡電話 *</span>
                <input name="phone" type="tel" required placeholder="例如：9123 4567" />
              </label>
              <label className="booking-field">
                <span>WhatsApp *</span>
                <label className="booking-wa-same">
                  <input
                    type="checkbox"
                    checked={waSame}
                    onChange={(e) => setWaSame(e.target.checked)}
                  />
                  同聯絡電話
                </label>
                {!waSame && (
                  <input name="whatsapp" type="tel" required placeholder="WhatsApp 號碼" />
                )}
              </label>
              <label className="booking-field">
                <span>工人姓名 *</span>
                <input name="workerName" type="text" required />
              </label>
              <label className="booking-field">
                <span>工人護照號碼 *</span>
                <input name="passport" type="text" required placeholder="Passport No." />
              </label>
              {service.fields.map((f) => (
                <label className="booking-field" key={f.key}>
                  <span>
                    {f.label}
                    {f.required ? " *" : ""}
                  </span>
                  {f.type === "textarea" ? (
                    <textarea name={`detail_${f.key}`} required={f.required} placeholder={f.placeholder} />
                  ) : (
                    <input
                      name={`detail_${f.key}`}
                      type={f.type}
                      required={f.required}
                      placeholder={f.placeholder}
                    />
                  )}
                </label>
              ))}
              <label className="booking-field booking-field-full">
                <span>備註</span>
                <textarea name="remark" placeholder="其他需要我哋留意嘅事項" />
              </label>
            </div>

            {/* 3. 上傳工人資料（必傳） */}
            <h2 className="booking-step-title">3. 上傳工人資料 *</h2>
            <p className="booking-upload-hint">
              請上傳工人簽證、護照、機票行程單等資料（JPG / PNG / PDF，最多{" "}
              {UPLOAD_LIMITS.maxFiles} 個，單個及合計均不能超過 4MB，至少 1 個；手機相片太大可截圖後再上傳）
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={UPLOAD_LIMITS.accept}
              className="booking-file-input"
              onChange={(e) => onPickFiles(e.target.files)}
            />
            {uploadError && <p className="booking-error">{uploadError}</p>}
            {files.length > 0 && (
              <ul className="booking-file-list">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    <span>{f.name}</span>
                    <button
                      type="button"
                      aria-label={`移除 ${f.name}`}
                      onClick={() => {
                        setUploadError("");
                        setFiles(files.filter((_, j) => j !== i));
                      }}
                    >
                      移除
                    </button>
                  </li>
                ))}
                <li className="booking-file-total">
                  合計 {(totalSize / 1024 / 1024).toFixed(1)}MB / 4MB
                </li>
              </ul>
            )}

            {state.phase === "error" && <p className="booking-error">{state.message}</p>}

            <button
              type="submit"
              className="booking-submit"
              disabled={state.phase === "submitting"}
            >
              {state.phase === "submitting" ? "提交中…" : "提交預約"}
            </button>
              </>
            )}
          </>
        )}
      </form>
      )}

      {/* 登出確認彈窗 */}
      {logoutConfirm && (
        <div
          className="booking-modal-mask"
          onClick={() => !loggingOut && setLogoutConfirm(false)}
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
                disabled={loggingOut}
                onClick={() => setLogoutConfirm(false)}
              >
                返回
              </button>
              <button
                type="button"
                className="booking-modal-confirm"
                disabled={loggingOut}
                onClick={logout}
              >
                {loggingOut ? "登出中…" : "確定登出"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 取消訂單確認彈窗 */}
      {cancelTarget && (
        <div
          className="booking-modal-mask"
          onClick={() => !cancelling && setCancelTarget(null)}
        >
          <div
            className="booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="cancel-dialog-title">取消預約？</h3>
            <p>
              確定要取消訂單 <strong>{cancelTarget.order_no}</strong>（
              {cancelTarget.service_label}）嗎？取消後不能恢復。
            </p>
            {cancelError && <p className="booking-error">{cancelError}</p>}
            <div className="booking-modal-actions">
              <button
                type="button"
                className="booking-modal-back"
                disabled={cancelling}
                onClick={() => setCancelTarget(null)}
              >
                返回
              </button>
              <button
                type="button"
                className="booking-modal-confirm"
                disabled={cancelling}
                onClick={cancelBooking}
              >
                {cancelling ? "取消中…" : "確定取消"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
