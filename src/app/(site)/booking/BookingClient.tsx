"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, Check, CircleCheck, Trash2, UploadCloud, Sparkles } from "lucide-react";
import { Badge, Button, Field, Input, Modal, Tabs, Textarea } from "@/components/ui";
import { SERVICES, UPLOAD_LIMITS, type ServiceItem } from "@/lib/booking/services";
import { openLogin } from "@/components/auth/login-events";
import AdminTheme from "@/components/admin/AdminTheme";
import AdminInterviews from "@/components/AdminInterviews";
import AdminInterviewRecords from "@/components/AdminInterviewRecords";

/** 預約工作台：頂層分組（服務預約 / AI 面試）+ 子分欄 */
type BookingGroup = "booking" | "interview";
type BookingTab = "book" | "passes" | "orders" | "questions" | "create" | "records";

const GROUP_OF: Record<BookingTab, BookingGroup> = {
  book: "booking",
  passes: "booking",
  orders: "booking",
  questions: "interview",
  create: "interview",
  records: "interview",
};

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

interface AccountInfo {
  email: string | null;
  phone: string | null;
}

const MY_STATUS: Record<string, { label: string; variant: "amber" | "green" | "red" | "gray" }> = {
  pending: { label: "待確認", variant: "amber" },
  confirmed: { label: "已確認", variant: "green" },
  rejected: { label: "未能安排", variant: "red" },
  cancelled: { label: "已取消", variant: "gray" },
};

/** 服務預約主頁：套票 / 購票 / 預約 三分頁（需登入） */
export default function BookingClient() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [buying, setBuying] = useState<string | null>(null);
  const [purchaseMsg, setPurchaseMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<MyBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [waSame, setWaSame] = useState(true);
  const [serviceKey, setServiceKey] = useState<string>("");
  const [tab, setTab] = useState<BookingTab>("book");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [state, setState] = useState<SubmitState>({ phase: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const service: ServiceItem | undefined = useMemo(
    () => SERVICES.find((s) => s.key === serviceKey),
    [serviceKey]
  );

  const loadMyBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/my/bookings", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMyBookings(data.bookings);
      }
    } catch {
      /* 列表失敗不影響下單 */
    }
  }, []);

  const loadBalances = useCallback(async () => {
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
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      if (data.customer) {
        setAccount({ email: data.customer.email, phone: data.customer.phone });
        await Promise.all([loadMyBookings(), loadBalances()]);
      } else {
        setAccount(null);
      }
    } finally {
      setAuthChecked(true);
    }
  }, [loadMyBookings, loadBalances]);

  useEffect(() => {
    void (async () => {
      await checkAuth();
      const params = new URLSearchParams(window.location.search);
      // 支持 ?tab= 直達指定子分欄（buy / interview 為舊鏈接映射）
      const t = params.get("tab");
      const legacy: Record<string, BookingTab> = { buy: "passes", interview: "create" };
      const mapped = (legacy[t || ""] || t) as BookingTab | null;
      if (mapped && GROUP_OF[mapped]) {
        setTab(mapped);
      }
      // Stripe 付款回跳提示
      const q = params.get("purchase");
      if (q === "success") {
        setPurchaseMsg({ ok: true, text: "付款成功，套票已入賬你的賬戶。" });
        setTab("passes");
        window.history.replaceState(null, "", "/booking?tab=passes");
      } else if (q === "cancelled") {
        setPurchaseMsg({ ok: false, text: "付款已取消，套票未扣費。" });
        setTab("passes");
        window.history.replaceState(null, "", "/booking?tab=passes");
      }
    })();
    const onAuthChanged = () => void checkAuth();
    window.addEventListener("nl-auth-changed", onAuthChanged);
    return () => window.removeEventListener("nl-auth-changed", onAuthChanged);
  }, [checkAuth]);

  const switchTab = (t: BookingTab) => {
    setTab(t);
    window.history.replaceState(null, "", t === "book" ? "/booking" : `/booking?tab=${t}`);
  };

  const buyPass = async (key: string, quantity: 1 | 10) => {
    setBuying(`${key}-${quantity}`);
    setPurchaseMsg(null);
    try {
      const res = await fetch("/api/passes/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceKey: key, quantity }),
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

  const cancelBooking = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch(`/api/my/bookings/${cancelTarget.id}/cancel`, { method: "POST" });
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

  // 未登入：直接彈出登入框（用戶關閉後可點按鈕重新打開）
  useEffect(() => {
    if (authChecked && !account) openLogin();
  }, [authChecked, account]);

  /* ---------- 未登入 / 載入中 ---------- */
  if (!authChecked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[14px] text-[#8b95ad]">
        載入中…
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-[#161b2e]">
          服務<span className="text-brand-gradient">預約</span>
        </h1>
        <p className="mt-3 text-[14px] leading-[1.85] text-[#5d6b85]">
          登入後即可購買套票並提交預約。
        </p>
        <Button size="lg" className="mt-6" onClick={() => openLogin()}>
          登入 / 註冊
        </Button>
      </div>
    );
  }

  /* ---------- 提交成功 ---------- */
  if (state.phase === "success") {
    return (
      <div className="relative flex flex-1 items-center justify-center px-6 py-20">
        <div className="card relative w-full max-w-[520px] p-10 text-center">
          <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#4cb896] to-[#2a9470] text-white shadow-[0_10px_30px_rgba(53,160,122,0.4)]">
            <CircleCheck size={30} aria-hidden="true" />
          </span>
          <h1 className="text-[22px] font-bold text-[#161b2e]">預約已提交</h1>
          <p className="mt-3 text-[14px] leading-[1.85] text-[#5d6b85]">
            你的訂單編號是 <strong className="text-[#2a8163]">{state.orderNo}</strong>。
            我們確認後會盡快通知你{account.email ? `（${account.email}）` : ""}，請留意{account.email ? "收件箱" : "短訊"}。
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              onClick={() => {
                setState({ phase: "idle" });
                setServiceKey("");
                setFiles([]);
                switchTab("book");
              }}
            >
              再次預約
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setState({ phase: "idle" });
                setServiceKey("");
                setFiles([]);
                switchTab("orders");
              }}
            >
              查看我的預約
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 主界面 ---------- */
  return (
    <div className="relative flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <div className="relative mx-auto max-w-[1100px]">
          {/* 頂層分組 Tab：服務預約 / AI 面試 */}
          <div className="mb-6 border-b border-[#e6e9f2]">
            <Tabs
              variant="underline"
              className="flex-wrap"
              active={GROUP_OF[tab]}
              onChange={(k) => switchTab(k === "booking" ? "book" : "questions")}
              items={[
                { key: "booking", label: "服務預約", icon: <CalendarPlus size={14} aria-hidden="true" /> },
                {
                  key: "interview",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      AI 面試
                      <span className="rounded-full bg-[#35a07a]/12 px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-wider text-[#2a8163]">
                        BETA
                      </span>
                    </span>
                  ),
                  icon: <Sparkles size={14} aria-hidden="true" />,
                },
              ]}
            />
          </div>

          {/* 子分欄 */}
          <Tabs
            variant="underline"
            className="mb-8 flex-wrap"
            active={tab}
            onChange={(k) => switchTab(k as BookingTab)}
            items={
              GROUP_OF[tab] === "booking"
                ? [
                    { key: "book", label: "發起預約" },
                    { key: "passes", label: "我的套票" },
                    { key: "orders", label: "我的預約" },
                  ]
                : [
                    { key: "questions", label: "題庫管理" },
                    { key: "create", label: "發起面試" },
                    { key: "records", label: "面試記錄" },
                  ]
            }
          />

          {/* ============ 我的套票（餘額 + 購買） ============ */}
          {tab === "passes" && (
            <div>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[16px] font-bold text-[#161b2e]">我的套票</h2>
                <Button variant="outline" size="sm" disabled={buying !== null} onClick={() => void claimDemoPass()}>
                  {buying === "demo" ? "領取中…" : "領取試用套票（演示）"}
                </Button>
              </div>
              {purchaseMsg && (
                <p
                  className={`mb-5 rounded-xl px-4 py-3 text-[13px] font-semibold ${
                    purchaseMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                  }`}
                >
                  {purchaseMsg.text}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {SERVICES.map((s) => {
                  const remaining = balances[s.key] || 0;
                  return (
                    <div key={s.key} className="flex flex-col rounded-2xl border border-[#e6e9f2] bg-white p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-[15px] text-[#161b2e]">{s.label}</strong>
                        <Badge variant={remaining > 0 ? "green" : "gray"}>剩餘 {remaining} 次</Badge>
                      </div>
                      <p className="mt-2 text-[13px] leading-[1.75] text-[#5d6b85]">{s.description}</p>
                      <ul className="mt-3 flex flex-col gap-1.5">
                        {s.includes.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-[12.5px] text-[#5d6b85]">
                            <Check size={13} className="mt-0.5 shrink-0 text-[#35a07a]" aria-hidden="true" />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-4 text-[12.5px] font-semibold text-[#8b95ad]">
                        單次 HK${s.priceSingle} ・ 10 次套票 HK${s.pricePack10}
                      </p>
                      <div className="mt-auto flex gap-2 pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled={buying !== null}
                          onClick={() => void buyPass(s.key, 1)}
                        >
                          {buying === `${s.key}-1` ? "跳轉中…" : `買 1 張`}
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={buying !== null}
                          onClick={() => void buyPass(s.key, 10)}
                        >
                          {buying === `${s.key}-10` ? "跳轉中…" : `買 10 張`}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============ 我的預約 ============ */}
          {tab === "orders" && (
            <div>
              <h2 className="mb-4 text-[16px] font-bold text-[#161b2e]">我的預約</h2>
              {myBookings.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {myBookings.map((b) => {
                    const st = MY_STATUS[b.status] || { label: b.status, variant: "gray" as const };
                    return (
                      <li
                        key={b.order_no}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-black/[0.06] bg-white/70 px-5 py-4 text-[13.5px]"
                      >
                        <span className="font-bold text-[#161b2e]">{b.order_no}</span>
                        <span className="text-[#3d4763]">{b.service_label}</span>
                        <span className="text-[#5d6b85]">{b.worker_name}</span>
                        <Badge variant={st.variant}>{st.label}</Badge>
                        <span className="ml-auto text-[12.5px] text-[#8b95ad]">
                          {new Date(b.created_at).toLocaleDateString("zh-HK")}
                        </span>
                        {b.status === "pending" && (
                          <Button variant="danger" size="sm" onClick={() => setCancelTarget(b)}>
                            取消
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed border-black/[0.1] px-5 py-8 text-center text-[13px] text-[#8b95ad]">
                  暫時未有預約紀錄。
                </p>
              )}
            </div>
          )}

          {/* ============ AI 面試 · 題庫管理（按用戶隔離） ============ */}
          {tab === "questions" && (
            <div>
              <p className="mb-6 max-w-[720px] text-[13px] leading-[1.85] text-[#5d6b85]">
                設置面試題目與考察要點，AI 會按此逐題評估。你的題庫僅自己可見，與其他用戶互不干擾。
              </p>
              <AdminTheme>
                <AdminInterviews apiBase="/api/my" section="questions" />
              </AdminTheme>
            </div>
          )}

          {/* ============ AI 面試 · 發起面試 ============ */}
          {tab === "create" && (
            <div>
              <p className="mb-6 max-w-[720px] text-[13px] leading-[1.85] text-[#5d6b85]">
                填寫工人姓名並上傳簡歷（可選），生成專屬面試連結發給工人；
                AI 自動完成語音轉寫、逐題評估並輸出整體報告。
              </p>
              <AdminTheme>
                <AdminInterviews apiBase="/api/my" section="create" />
              </AdminTheme>
            </div>
          )}

          {/* ============ AI 面試 · 面試記錄 ============ */}
          {tab === "records" && (
            <div>
              <h2 className="mb-4 text-[16px] font-bold text-[#161b2e]">面試記錄</h2>
              <AdminTheme>
                <AdminInterviewRecords apiBase="/api/my" />
              </AdminTheme>
            </div>
          )}

          {/* ============ 發起預約 ============ */}
          {tab === "book" && (
            <form onSubmit={onSubmit}>
              <h2 className="mb-4 text-[16px] font-bold text-[#161b2e]">1. 選擇服務</h2>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {SERVICES.map((s) => {
                  const selected = serviceKey === s.key;
                  const remaining = balances[s.key] || 0;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setServiceKey(s.key)}
                      className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border-2 p-3.5 text-left transition-all duration-200 ${
                        selected
                          ? "border-[#35a07a] bg-gradient-to-br from-[#4cb896]/[0.06] to-[#2a9470]/[0.06] shadow-[0_6px_16px_rgba(53,160,122,0.10)]"
                          : "border-black/[0.07] bg-white/70 hover:border-[#35a07a]/40"
                      }`}
                    >
                      <span className="text-[14px] leading-snug font-bold text-[#161b2e]">{s.label}</span>
                      <Badge variant={remaining > 0 ? "green" : "gray"} className="w-fit">
                        {remaining > 0 ? `剩餘 ${remaining} 次` : "未購套票"}
                      </Badge>
                      <span className="text-[12px] leading-[1.6] text-[#5d6b85]">{s.description}</span>
                      <span className="text-[12.5px] font-bold text-[#2a8163]">HK${s.priceSingle}/次</span>
                    </button>
                  );
                })}
              </div>

              {service && (
                <>
                  <div className="mt-5 rounded-2xl bg-[#e9f5f0]/70 px-5 py-4 text-[13px] leading-[1.8] text-[#3d4763]">
                    <strong className="text-[#161b2e]">{service.label}包括：</strong>
                    <ul className="mt-1 list-disc pl-5">
                      {service.includes.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {(balances[service.key] || 0) === 0 ? (
                    <div className="mt-5 rounded-2xl border border-dashed border-[#35a07a]/40 bg-[#e9f5f0]/50 p-6 text-center">
                      <p className="text-[13.5px] leading-[1.8] text-[#3d4763]">
                        你未購買「{service.label}」套票，暫時不能填寫預約資料。
                        請先到「我的套票」分頁購買，或領取試用套票體驗流程。
                      </p>
                      <Button className="mt-4" onClick={() => switchTab("passes")}>
                        前往購買套票
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h2 className="mt-8 mb-4 text-[16px] font-bold text-[#161b2e]">2. 填寫資料</h2>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="僱主姓名" required>
                          <Input name="employerName" required />
                        </Field>
                        <Field label="聯絡電話" required>
                          <Input name="phone" type="tel" required placeholder="例如：9123 4567" />
                        </Field>
                        <Field label="WhatsApp" required>
                          <label className="mb-2 flex cursor-pointer items-center gap-2 text-[12.5px] text-[#5d6b85]">
                            <input
                              type="checkbox"
                              checked={waSame}
                              onChange={(e) => setWaSame(e.target.checked)}
                              className="h-4 w-4 cursor-pointer appearance-none rounded-md border border-black/[0.15] bg-white transition-all checked:border-transparent checked:bg-gradient-to-br checked:from-[#4cb896] checked:to-[#2a9470]"
                            />
                            同聯絡電話
                          </label>
                          {!waSame && <Input name="whatsapp" type="tel" required placeholder="WhatsApp 號碼" />}
                        </Field>
                        <Field label="工人姓名" required>
                          <Input name="workerName" required />
                        </Field>
                        <Field label="工人護照號碼" required>
                          <Input name="passport" required placeholder="Passport No." />
                        </Field>
                        {!account.email && (
                          <Field
                            label="聯絡電郵"
                            required
                            hint="你的賬戶未綁定電郵，確認通知將發送到此郵箱"
                          >
                            <Input name="contactEmail" type="email" required placeholder="you@example.com" />
                          </Field>
                        )}
                        {service.fields.map((f) => (
                          <Field key={f.key} label={f.label} required={f.required}>
                            {f.type === "textarea" ? (
                              <Textarea name={`detail_${f.key}`} required={f.required} placeholder={f.placeholder} />
                            ) : (
                              <Input
                                name={`detail_${f.key}`}
                                type={f.type}
                                required={f.required}
                                placeholder={f.placeholder}
                              />
                            )}
                          </Field>
                        ))}
                        <Field label="備註" className="sm:col-span-2">
                          <Textarea name="remark" placeholder="其他需要我們留意的事項" />
                        </Field>
                      </div>

                      <h2 className="mt-8 mb-2 text-[16px] font-bold text-[#161b2e]">3. 上傳工人資料 *</h2>
                      <p className="mb-4 text-[12.5px] leading-[1.8] text-[#8b95ad]">
                        請上傳工人簽證、護照、機票行程單等資料（JPG / PNG / PDF，最多 {UPLOAD_LIMITS.maxFiles} 個，
                        單個及合計均不能超過 4MB，至少 1 個；手機相片太大可截圖後再上傳）
                      </p>
                      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-[#35a07a]/35 bg-[#e9f5f0]/40 px-5 py-8 text-center transition-colors hover:border-[#35a07a]/60">
                        <UploadCloud size={24} className="text-[#35a07a]" aria-hidden="true" />
                        <span className="text-[13px] font-semibold text-[#2a8163]">點擊選擇檔案</span>
                        <span className="text-[11.5px] text-[#8b95ad]">JPG / PNG / PDF・合計 ≤ 4MB</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept={UPLOAD_LIMITS.accept}
                          className="hidden"
                          onChange={(e) => onPickFiles(e.target.files)}
                        />
                      </label>
                      {uploadError && <p className="mt-3 text-[13px] font-medium text-red-600">{uploadError}</p>}
                      {files.length > 0 && (
                        <ul className="mt-4 flex flex-col gap-2">
                          {files.map((f, i) => (
                            <li
                              key={`${f.name}-${i}`}
                              className="flex items-center justify-between gap-3 rounded-xl bg-black/[0.03] px-4 py-2.5 text-[13px]"
                            >
                              <span className="min-w-0 truncate text-[#3d4763]">{f.name}</span>
                              <button
                                type="button"
                                aria-label={`移除 ${f.name}`}
                                className="cursor-pointer text-[#8b95ad] transition-colors hover:text-red-600"
                                onClick={() => {
                                  setUploadError("");
                                  setFiles(files.filter((_, j) => j !== i));
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </li>
                          ))}
                          <li className="text-right text-[12px] text-[#8b95ad]">
                            合計 {(totalSize / 1024 / 1024).toFixed(1)}MB / 4MB
                          </li>
                        </ul>
                      )}

                      {state.phase === "error" && (
                        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-600">
                          {state.message}
                        </p>
                      )}

                      <Button type="submit" size="lg" className="mt-7 w-full" loading={state.phase === "submitting"}>
                        提交預約
                      </Button>
                    </>
                  )}
                </>
              )}
            </form>
          )}
      </div>

      {/* 取消訂單確認彈窗 */}
      <Modal
        open={cancelTarget !== null}
        onClose={() => !cancelling && setCancelTarget(null)}
        title="取消預約？"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              返回
            </Button>
            <Button variant="danger" onClick={() => void cancelBooking()} loading={cancelling}>
              確定取消
            </Button>
          </>
        }
      >
        {cancelTarget && (
          <>
            <p className="text-[14px] leading-[1.8] text-[#5d6b85]">
              確定要取消訂單 <strong className="text-[#161b2e]">{cancelTarget.order_no}</strong>
              （{cancelTarget.service_label}）嗎？取消後不能恢復，已用套票將退回賬戶。
            </p>
            {cancelError && <p className="mt-3 text-[13px] font-medium text-red-600">{cancelError}</p>}
          </>
        )}
      </Modal>
    </div>
  );
}
