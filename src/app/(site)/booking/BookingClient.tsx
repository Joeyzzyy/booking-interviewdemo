"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, Check, CircleCheck, MessageSquareText, Trash2, UploadCloud, Sparkles } from "lucide-react";
import { Badge, Button, Field, Input, Modal, Tabs, Textarea } from "@/components/ui";
import { SERVICES, UPLOAD_LIMITS, type ServiceItem } from "@/lib/booking/services";
import { openLogin } from "@/components/auth/login-events";
import AdminTheme from "@/components/admin/AdminTheme";
import ProfileOnboarding from "@/components/ProfileOnboarding";
import AdminInterviews from "@/components/AdminInterviews";
import AdminInterviewRecords from "@/components/AdminInterviewRecords";
import BoardPanel from "@/components/BoardPanel";
import { useLanguage, LOCALES } from "@/lib/i18n";

/** 預約工作台：頂層分組（服務預約 / AI 面試）+ 子分欄 */
type BookingGroup = "booking" | "interview" | "board";
type BookingTab = "book" | "passes" | "orders" | "questions" | "create" | "records" | "board";

const GROUP_OF: Record<BookingTab, BookingGroup> = {
  book: "booking",
  passes: "booking",
  orders: "booking",
  questions: "interview",
  create: "interview",
  records: "interview",
  board: "board",
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
  admin_note: string | null;
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
  profileComplete: boolean;
  profileStatus: "pending" | "approved" | "rejected";
  profileRejectReason: string | null;
  applicantName: string | null;
  companyName: string | null;
  labourRegNo: string | null;
}

const MY_STATUS: Record<string, "amber" | "green" | "red" | "gray"> = {
  pending: "amber",
  confirmed: "green",
  rejected: "red",
  cancelled: "gray",
};

/** 訂單狀態對應左側強調色（我的預約列表用） */
const ORDER_ACCENT: Record<string, string> = {
  pending: "border-l-amber-400",
  confirmed: "border-l-[#35a07a]",
  rejected: "border-l-red-400",
  cancelled: "border-l-gray-300",
};

/** 步驟標題：漸變序號徽章 + 標題（發起預約三步用） */
function StepHeading({ n, title, desc }: { n: string; title: string; desc?: string }) {
  return (
    <div className="mt-9 mb-4 flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4cb896] to-[#2a9470] text-[14px] font-extrabold text-white shadow-[0_5px_14px_rgba(53,160,122,0.4)]">
        {n}
      </span>
      <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-[#161b2e]">{title}</h2>
      {desc && <span className="text-[12.5px] text-[#8b95ad]">{desc}</span>}
    </div>
  );
}

/** 服務預約主頁：套票 / 購票 / 預約 三分頁（需登入） */
export default function BookingClient() {
  const { t, locale } = useLanguage();
  /** 日期格式化語言標籤（zh-HK / zh-CN / en） */
  const dateLocale = LOCALES.find((l) => l.key === locale)?.htmlLang ?? "zh-HK";
  /** 服務名稱/描述/包含項按當前語言展示（數據庫存儲值保持繁體） */
  const svcText = (key: string) =>
    t.services.items[key as keyof typeof t.services.items] as
      | { label: string; description: string; includes: string[] }
      | undefined;
  const statusLabel = (status: string) =>
    (t.workspace.orders.status as Record<string, string>)[status] ?? status;
  /** 訂單的服務名按當前語言展示（DB 存儲的是繁體 label，用於反查 service key） */
  const svcLabelOf = (storedLabel: string) => {
    const svc = SERVICES.find((s) => s.label === storedLabel);
    return svc ? (svcText(svc.key)?.label ?? storedLabel) : storedLabel;
  };
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [buying, setBuying] = useState<string | null>(null);
  const [purchaseMsg, setPurchaseMsg] = useState<{ ok: boolean; text: string } | null>(null);
  /** Stripe 付款回跳提示（文案按當前語言渲染） */
  const [purchaseFlash, setPurchaseFlash] = useState<"success" | "cancelled" | null>(null);
  const [cancelTarget, setCancelTarget] = useState<MyBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [waSame, setWaSame] = useState(true);
  const [serviceKey, setServiceKey] = useState<string>("");
  const [tab, setTab] = useState<BookingTab>("book");
  const [createdIv, setCreatedIv] = useState<{ token: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [passport, setPassport] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrMsg, setOcrMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ticket, setTicket] = useState<File | null>(null);
  const [state, setState] = useState<SubmitState>({ phase: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const passportInputRef = useRef<HTMLInputElement>(null);
  const ticketInputRef = useRef<HTMLInputElement>(null);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0) + (ticket?.size || 0);

  const service: ServiceItem | undefined = useMemo(
    () => SERVICES.find((s) => s.key === serviceKey),
    [serviceKey]
  );

  /** 接機類服務（有航班編號欄位）必須上傳機票 */
  const needsTicket = useMemo(
    () => Boolean(service?.fields.some((f) => f.key === "flightNo")),
    [service]
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
        setAccount({
          email: data.customer.email,
          phone: data.customer.phone,
          profileComplete: Boolean(data.customer.profileComplete),
          profileStatus: data.customer.profileStatus || "pending",
          profileRejectReason: data.customer.profileRejectReason || null,
          applicantName: data.customer.applicantName || null,
          companyName: data.customer.companyName || null,
          labourRegNo: data.customer.labourRegNo || null,
        });
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
        setPurchaseFlash("success");
        setTab("passes");
        window.history.replaceState(null, "", "/booking?tab=passes");
      } else if (q === "cancelled") {
        setPurchaseFlash("cancelled");
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
    setPurchaseFlash(null);
    try {
      const res = await fetch("/api/passes/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceKey: key, quantity }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPurchaseMsg({ ok: false, text: data.error || t.workspace.purchase.createFailed });
        return;
      }
      window.location.assign(data.url); // 跳轉 Stripe 付款頁
    } catch {
      setPurchaseMsg({ ok: false, text: t.workspace.networkError });
    } finally {
      setBuying(null);
    }
  };

  /** 演示用：領取試用套票（正式購票開通後接口自動停用） */
  const claimDemoPass = async () => {
    setBuying("demo");
    setPurchaseMsg(null);
    setPurchaseFlash(null);
    try {
      const res = await fetch("/api/passes/demo-buy", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setPurchaseMsg({ ok: false, text: data.error || t.workspace.purchase.claimFailed });
        return;
      }
      const map: Record<string, number> = {};
      for (const b of data.balances) map[b.serviceKey] = b.remaining;
      setBalances(map);
      setPurchaseMsg({ ok: true, text: t.workspace.purchase.demoCredited });
    } catch {
      setPurchaseMsg({ ok: false, text: t.workspace.networkError });
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
        setCancelError(data.error || t.workspace.cancelModal.failed);
        return;
      }
      setCancelTarget(null);
      await Promise.all([loadMyBookings(), loadBalances()]);
    } catch {
      setCancelError(t.workspace.networkError);
    } finally {
      setCancelling(false);
    }
  };

  /** 共用校驗後追加檔案（工人資料 / 護照 OCR 檔案都走呢度） */
  const addFiles = (incoming: File[]) => {
    const next = [...files, ...incoming].slice(0, UPLOAD_LIMITS.maxFiles);
    const oversized = next.find((f) => f.size > UPLOAD_LIMITS.maxFileSize);
    if (oversized) {
      setUploadError(t.workspace.book.upload.fileTooLarge(oversized.name));
      return;
    }
    const total = next.reduce((sum, f) => sum + f.size, 0);
    if (total > UPLOAD_LIMITS.maxTotalSize) {
      setUploadError(t.workspace.book.upload.totalTooLarge);
      return;
    }
    setUploadError("");
    setFiles(next);
  };

  const onPickFiles = (list: FileList | null) => {
    if (!list) return;
    addFiles(Array.from(list));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** 護照 OCR：上傳 → /api/bookings/parse-passport → 回填姓名 + 護照號；檔案一併加入上傳清單 */
  const onPickPassport = async (f: File | null) => {
    if (passportInputRef.current) passportInputRef.current.value = "";
    if (!f) return;
    setOcrLoading(true);
    setOcrMsg(null);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/bookings/parse-passport", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setOcrMsg({ ok: false, text: data.error || t.workspace.book.ocr.failed });
        return;
      }
      if (data.workerName) setWorkerName(data.workerName);
      if (data.passportNo) setPassport(data.passportNo);
      addFiles([f]);
      setOcrMsg({ ok: true, text: t.workspace.book.ocr.done });
    } catch {
      setOcrMsg({ ok: false, text: t.workspace.book.ocr.networkError });
    } finally {
      setOcrLoading(false);
    }
  };

  const onPickTicket = (f: File | null) => {
    if (ticketInputRef.current) ticketInputRef.current.value = "";
    if (!f) return;
    if (f.size > UPLOAD_LIMITS.maxFileSize) {
      setUploadError(t.workspace.book.ticket.tooLarge(f.name));
      return;
    }
    if (f.size + files.reduce((sum, x) => sum + x.size, 0) > UPLOAD_LIMITS.maxTotalSize) {
      setUploadError(t.workspace.book.upload.totalTooLarge);
      return;
    }
    setUploadError("");
    setTicket(f);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!service) return;
    if (files.length === 0) {
      setState({ phase: "error", message: t.workspace.book.needWorkerDocs });
      return;
    }
    if (needsTicket && !ticket) {
      setState({ phase: "error", message: t.workspace.book.ticket.required });
      return;
    }
    setState({ phase: "submitting" });

    const form = new FormData(e.currentTarget);
    form.set("serviceKey", service.key);
    if (waSame) form.set("whatsapp", (form.get("phone") as string) || "");
    for (const f of files) form.append("files", f);
    if (ticket) form.set("flightTicket", ticket);

    try {
      const res = await fetch("/api/bookings", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setState({ phase: "error", message: data.error || t.workspace.submitFailed });
        return;
      }
      setState({ phase: "success", orderNo: data.orderNo });
      await Promise.all([loadMyBookings(), loadBalances()]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setState({ phase: "error", message: t.workspace.networkError });
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
        {t.workspace.loading}
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-[#161b2e]">
          {t.workspace.loginRequired.titleBefore}<span className="text-brand-gradient">{t.workspace.loginRequired.titleAccent}</span>
        </h1>
        <p className="mt-3 text-[14px] leading-[1.85] text-[#5d6b85]">
          {t.workspace.loginRequired.hint}
        </p>
        <Button size="lg" className="mt-6" onClick={() => openLogin()}>
          {t.header.login}
        </Button>
      </div>
    );
  }

  /* ---------- 未提交資料 或 審核被拒：顯示表單（被拒時頂部附原因） ---------- */
  if (!account.profileComplete || account.profileStatus === "rejected") {
    return (
      <ProfileOnboarding
        onDone={() => void checkAuth()}
        rejectReason={account.profileStatus === "rejected" ? account.profileRejectReason : null}
        initial={{
          applicantName: account.applicantName,
          companyName: account.companyName,
          labourRegNo: account.labourRegNo,
        }}
      />
    );
  }

  /* ---------- 已提交，等待審核 ---------- */
  if (account.profileStatus !== "approved") {
    return (
      <div className="relative flex flex-1 items-center justify-center px-6 py-24">
        <div className="card relative w-full max-w-[480px] p-10 text-center">
          <h1 className="text-[22px] font-bold text-[#161b2e]">{t.workspace.pending.title}</h1>
          <p className="mt-3 text-[14px] leading-[1.85] text-[#5d6b85]">
            {t.workspace.pending.body}
            {account.email
              ? t.workspace.pending.emailNotice(account.email)
              : t.workspace.pending.laterNotice}
          </p>
        </div>
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
          <h1 className="text-[22px] font-bold text-[#161b2e]">{t.workspace.success.title}</h1>
          <p className="mt-3 text-[14px] leading-[1.85] text-[#5d6b85]">
            {t.workspace.success.orderNoPrefix}
            <strong className="text-[#2a8163]">{state.orderNo}</strong>
            {t.workspace.success.orderNoSuffix}{" "}
            {account.email ? t.workspace.success.notifyEmail(account.email) : t.workspace.success.notifySms}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              onClick={() => {
                setState({ phase: "idle" });
                setServiceKey("");
                setFiles([]);
                setTicket(null);
                setWorkerName("");
                setPassport("");
                setOcrMsg(null);
                switchTab("book");
              }}
            >
              {t.workspace.success.bookAgain}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setState({ phase: "idle" });
                setServiceKey("");
                setFiles([]);
                setTicket(null);
                setWorkerName("");
                setPassport("");
                setOcrMsg(null);
                switchTab("orders");
              }}
            >
              {t.workspace.success.viewOrders}
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
              onChange={(k) => switchTab(k === "booking" ? "book" : k === "interview" ? "questions" : "board")}
              items={[
                { key: "booking", label: t.workspace.tabs.booking, icon: <CalendarPlus size={14} aria-hidden="true" /> },
                {
                  key: "interview",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      {t.workspace.tabs.interview}
                      <span className="rounded-full bg-[#35a07a]/12 px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-wider text-[#2a8163]">
                        BETA
                      </span>
                    </span>
                  ),
                  icon: <Sparkles size={14} aria-hidden="true" />,
                },
                { key: "board", label: t.workspace.tabs.board, icon: <MessageSquareText size={14} aria-hidden="true" /> },
              ]}
            />
          </div>

          {/* 品牌橫幅（服務預約分組）：賬戶 + 套票餘額一覽 */}
          {GROUP_OF[tab] === "booking" && (
            <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#2a9470] via-[#35a07a] to-[#4cb896] px-6 py-6 text-white shadow-[0_16px_40px_rgba(42,148,112,0.3)] sm:px-8">
              {/* 裝飾光圈 */}
              <span className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
              <span className="pointer-events-none absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-[#b7f0d8]/25 blur-2xl" aria-hidden="true" />
              <p className="text-[12px] font-semibold tracking-[0.18em] text-white/75">NEXUSLINK · 傭易做</p>
              <h1 className="mt-1 text-[22px] font-extrabold tracking-[-0.01em] sm:text-[26px]">
                {t.workspace.hero.title}
              </h1>
              <p className="mt-1 text-[13px] text-white/85">
                {account.email || account.phone} · {t.workspace.hero.subtitle}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {SERVICES.map((s) => {
                  const n = balances[s.key] || 0;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => switchTab("passes")}
                      className={`cursor-pointer rounded-full px-3.5 py-1.5 text-[12px] font-bold backdrop-blur-sm transition-all ${
                        n > 0
                          ? "bg-white text-[#2a8163] shadow-[0_3px_10px_rgba(0,0,0,0.12)] hover:-translate-y-0.5"
                          : "bg-white/15 text-white/85 hover:bg-white/25"
                      }`}
                    >
                      {svcText(s.key)?.label ?? s.label} · {n > 0 ? t.workspace.hero.remaining(n) : t.workspace.hero.noPasses}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 子分欄（資訊交流區只有一頁，唔需要子分欄） */}
          {GROUP_OF[tab] !== "board" && (
            <Tabs
              variant="underline"
              className="mb-8 flex-wrap"
              active={tab}
              onChange={(k) => switchTab(k as BookingTab)}
              items={
                GROUP_OF[tab] === "booking"
                  ? [
                      { key: "book", label: t.workspace.tabs.book },
                      { key: "passes", label: t.workspace.tabs.passes },
                      { key: "orders", label: t.workspace.tabs.orders },
                    ]
                  : [
                      { key: "questions", label: t.workspace.tabs.questions },
                      { key: "create", label: t.workspace.tabs.create },
                      { key: "records", label: t.workspace.tabs.records },
                    ]
              }
            />
          )}

          {/* ============ 我的套票（餘額 + 購買） ============ */}
          {tab === "passes" && (
            <div>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[16px] font-bold text-[#161b2e]">{t.workspace.passes.title}</h2>
                <Button variant="outline" size="sm" disabled={buying !== null} onClick={() => void claimDemoPass()}>
                  {buying === "demo" ? t.workspace.passes.claiming : t.workspace.passes.claimDemo}
                </Button>
              </div>
              {purchaseFlash && (
                <p
                  className={`mb-5 rounded-xl px-4 py-3 text-[13px] font-semibold ${
                    purchaseFlash === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                  }`}
                >
                  {purchaseFlash === "success" ? t.workspace.purchase.success : t.workspace.purchase.cancelled}
                </p>
              )}
              {purchaseMsg && (
                <p
                  className={`mb-5 rounded-xl px-4 py-3 text-[13px] font-semibold ${
                    purchaseMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                  }`}
                >
                  {purchaseMsg.text}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {SERVICES.map((s) => {
                  const remaining = balances[s.key] || 0;
                  return (
                    <div
                      key={s.key}
                      className={`relative flex flex-col overflow-hidden rounded-2xl border p-5 transition-shadow hover:shadow-[0_10px_30px_rgba(42,148,112,0.14)] ${
                        remaining > 0
                          ? "border-[#35a07a]/30 bg-gradient-to-b from-[#e9f5f0]/80 to-white"
                          : "border-[#e6e9f2] bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-[15px] text-[#161b2e]">{svcText(s.key)?.label ?? s.label}</strong>
                        {remaining > 0 ? (
                          <span className="rounded-full bg-gradient-to-br from-[#4cb896] to-[#2a9470] px-3 py-1 text-[12px] font-extrabold text-white shadow-[0_3px_10px_rgba(53,160,122,0.35)]">
                            {t.workspace.passes.remaining(remaining)}
                          </span>
                        ) : (
                          <Badge variant="gray">{t.workspace.passes.noPasses}</Badge>
                        )}
                      </div>
                      <p className="mt-2 text-[13px] leading-[1.75] text-[#5d6b85]">{svcText(s.key)?.description ?? s.description}</p>
                      <ul className="mt-3 flex flex-col gap-1.5">
                        {(svcText(s.key)?.includes ?? s.includes).map((item) => (
                          <li key={item} className="flex items-start gap-2 text-[12.5px] text-[#5d6b85]">
                            <Check size={13} className="mt-0.5 shrink-0 text-[#35a07a]" aria-hidden="true" />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-lg bg-black/[0.04] px-2.5 py-1 text-[12.5px] font-bold text-[#3d4763]">
                          {t.workspace.passes.singlePrice(s.priceSingle)}
                        </span>
                        <span className="rounded-lg bg-[#e9f5f0] px-2.5 py-1 text-[12.5px] font-extrabold text-[#2a8163]">
                          {t.workspace.passes.packPrice(s.pricePack10)}
                        </span>
                      </div>
                      <div className="mt-auto flex gap-2 pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled={buying !== null}
                          onClick={() => void buyPass(s.key, 1)}
                        >
                          {buying === `${s.key}-1` ? t.workspace.passes.redirecting : t.workspace.passes.buy1}
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={buying !== null}
                          onClick={() => void buyPass(s.key, 10)}
                        >
                          {buying === `${s.key}-10` ? t.workspace.passes.redirecting : t.workspace.passes.buy10}
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
              <h2 className="mb-4 text-[16px] font-bold text-[#161b2e]">{t.workspace.orders.title}</h2>
              {myBookings.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {myBookings.map((b) => {
                    const st = MY_STATUS[b.status] || ("gray" as const);
                    return (
                      <li
                        key={b.order_no}
                        className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-l-4 border-black/[0.06] bg-white px-5 py-4 text-[13.5px] shadow-[0_2px_10px_rgba(22,27,46,0.05)] ${ORDER_ACCENT[b.status] || ""}`}
                      >
                        <span className="font-bold text-[#161b2e]">{b.order_no}</span>
                        <span className="text-[#3d4763]">{svcLabelOf(b.service_label)}</span>
                        <span className="text-[#5d6b85]">{b.worker_name}</span>
                        <Badge variant={st}>{statusLabel(b.status)}</Badge>
                        <span className="ml-auto text-[12.5px] text-[#8b95ad]">
                          {new Date(b.created_at).toLocaleDateString(dateLocale)}
                        </span>
                        {b.status === "pending" && (
                          <Button variant="danger" size="sm" onClick={() => setCancelTarget(b)}>
                            {t.workspace.orders.cancel}
                          </Button>
                        )}
                        {b.admin_note && (
                          <p
                            className={`w-full rounded-xl px-4 py-2.5 text-[12.5px] leading-[1.7] ${
                              b.status === "rejected"
                                ? "bg-red-50 text-red-600"
                                : "bg-black/[0.03] text-[#5d6b85]"
                            }`}
                          >
                            <strong>
                              {b.status === "rejected"
                                ? t.workspace.orders.rejectReason
                                : b.status === "confirmed"
                                  ? t.workspace.orders.confirmNote
                                  : t.workspace.orders.note}
                              {locale === "en" ? ": " : "："}
                            </strong>
                            {b.admin_note}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed border-black/[0.1] px-5 py-8 text-center text-[13px] text-[#8b95ad]">
                  {t.workspace.orders.empty}
                </p>
              )}
            </div>
          )}

          {/* ============ 資訊交流區（無子分欄，加返間距） ============ */}
          {tab === "board" && (
            <div className="mt-6">
              <BoardPanel />
            </div>
          )}

          {/* ============ AI 面試 · 題庫管理（按用戶隔離） ============ */}
          {tab === "questions" && (
            <div>
              <p className="mb-6 max-w-[720px] text-[13px] leading-[1.85] text-[#5d6b85]">
                {t.workspace.interview.questionsIntro}
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
                {t.workspace.interview.createIntro}
              </p>
              <AdminTheme>
                <AdminInterviews
                  apiBase="/api/my"
                  section="create"
                  onCreated={(info) => {
                    setCreatedIv(info);
                    switchTab("records"); // 自動切到面試記錄；彈窗關閉後即見記錄頁
                  }}
                />
              </AdminTheme>
            </div>
          )}

          {/* ============ AI 面試 · 面試記錄 ============ */}
          {tab === "records" && (
            <div>
              <h2 className="mb-4 text-[16px] font-bold text-[#161b2e]">{t.workspace.interview.recordsTitle}</h2>
              <AdminTheme>
                <AdminInterviewRecords apiBase="/api/my" />
              </AdminTheme>
            </div>
          )}

          {/* ============ 發起預約 ============ */}
          {tab === "book" && (
            <form onSubmit={onSubmit}>
              <StepHeading n="1" title={t.workspace.book.step1Title} desc={t.workspace.book.step1Desc} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {SERVICES.map((s) => {
                  const selected = serviceKey === s.key;
                  const remaining = balances[s.key] || 0;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setServiceKey(s.key)}
                      className={`flex cursor-pointer flex-col gap-1.5 rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
                        selected
                          ? "border-transparent bg-gradient-to-br from-[#4cb896] to-[#2a9470] text-white shadow-[0_12px_28px_rgba(42,148,112,0.35)]"
                          : "border-black/[0.07] bg-white hover:-translate-y-0.5 hover:border-[#35a07a]/50 hover:shadow-[0_8px_20px_rgba(42,148,112,0.12)]"
                      }`}
                    >
                      <span className={`text-[14.5px] leading-snug font-extrabold ${selected ? "text-white" : "text-[#161b2e]"}`}>
                        {svcText(s.key)?.label ?? s.label}
                      </span>
                      <span
                        className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          selected
                            ? "bg-white/20 text-white"
                            : remaining > 0
                              ? "bg-[#e9f5f0] text-[#2a8163]"
                              : "bg-black/[0.04] text-[#8b95ad]"
                        }`}
                      >
                        {remaining > 0 ? t.workspace.passes.remaining(remaining) : t.workspace.passes.noPasses}
                      </span>
                      <span className={`text-[12px] leading-[1.6] ${selected ? "text-white/85" : "text-[#5d6b85]"}`}>
                        {svcText(s.key)?.description ?? s.description}
                      </span>
                      <span className={`mt-auto pt-1 text-[15px] font-extrabold ${selected ? "text-white" : "text-[#2a8163]"}`}>
                        HK${s.priceSingle}
                        <span className={`ml-1 text-[11px] font-semibold ${selected ? "text-white/75" : "text-[#8b95ad]"}`}>{t.services.perTime}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {service && (
                <>
                  <div className="mt-5 rounded-2xl border-l-4 border-[#35a07a] bg-gradient-to-r from-[#e9f5f0] to-white px-5 py-4 text-[13px] leading-[1.8] text-[#3d4763]">
                    <strong className="text-[#161b2e]">{t.workspace.book.includes(svcText(service.key)?.label ?? service.label)}</strong>
                    <ul className="mt-1 list-disc pl-5">
                      {(svcText(service.key)?.includes ?? service.includes).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {(balances[service.key] || 0) === 0 ? (
                    <div className="mt-5 rounded-2xl border border-amber-300/60 bg-gradient-to-r from-amber-50 to-white p-6 text-center">
                      <p className="text-[13.5px] leading-[1.8] text-[#7a5b16]">
                        {t.workspace.book.noPassWarning(svcText(service.key)?.label ?? service.label)}
                      </p>
                      <Button className="mt-4" onClick={() => switchTab("passes")}>
                        {t.workspace.book.goBuyPasses}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <StepHeading n="2" title={t.workspace.book.step2Title} />

                      {/* 護照自動識別 */}
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-[#35a07a]/35 bg-[#e9f5f0]/40 px-5 py-4">
                        <div>
                          <p className="text-[13.5px] font-semibold text-[#161b2e]">
                            {t.workspace.book.ocr.title}
                          </p>
                          <p className="mt-0.5 text-[12px] text-[#8b95ad]">
                            {t.workspace.book.ocr.hint}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          loading={ocrLoading}
                          onClick={() => passportInputRef.current?.click()}
                        >
                          {ocrLoading ? t.workspace.book.ocr.loading : t.workspace.book.ocr.pick}
                        </Button>
                        <input
                          ref={passportInputRef}
                          type="file"
                          accept={UPLOAD_LIMITS.accept}
                          className="hidden"
                          onChange={(e) => void onPickPassport(e.target.files?.[0] || null)}
                        />
                      </div>
                      {ocrMsg && (
                        <p
                          className={`mb-4 rounded-xl px-4 py-3 text-[13px] font-medium ${
                            ocrMsg.ok ? "bg-[#e9f5f0] text-[#2a8163]" : "bg-red-50 text-red-600"
                          }`}
                        >
                          {ocrMsg.text}
                        </p>
                      )}

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t.workspace.book.fields.employerName}>
                          <Input name="employerName" placeholder={t.workspace.book.fields.optional} />
                        </Field>
                        <Field label={t.workspace.book.fields.phone} required>
                          <Input name="phone" type="tel" required placeholder={t.workspace.book.fields.phonePlaceholder} />
                        </Field>
                        <Field label={t.workspace.book.fields.whatsapp} required>
                          <label className="mb-2 flex cursor-pointer items-center gap-2 text-[12.5px] text-[#5d6b85]">
                            <input
                              type="checkbox"
                              checked={waSame}
                              onChange={(e) => setWaSame(e.target.checked)}
                              className="h-4 w-4 cursor-pointer appearance-none rounded-md border border-black/[0.15] bg-white transition-all checked:border-transparent checked:bg-gradient-to-br checked:from-[#4cb896] checked:to-[#2a9470]"
                            />
                            {t.workspace.book.fields.sameAsPhone}
                          </label>
                          {!waSame && <Input name="whatsapp" type="tel" required placeholder={t.workspace.book.fields.whatsappPlaceholder} />}
                        </Field>
                        <Field label={t.workspace.book.fields.workerName} required>
                          <Input
                            name="workerName"
                            required
                            value={workerName}
                            onChange={(e) => setWorkerName(e.target.value)}
                          />
                        </Field>
                        <Field label={t.workspace.book.fields.passport} required>
                          <Input
                            name="passport"
                            required
                            placeholder="Passport No."
                            value={passport}
                            onChange={(e) => setPassport(e.target.value)}
                          />
                        </Field>
                        {!account.email && (
                          <Field
                            label={t.workspace.book.fields.contactEmail}
                            required
                            hint={t.workspace.book.fields.contactEmailHint}
                          >
                            <Input name="contactEmail" type="email" required placeholder="you@example.com" />
                          </Field>
                        )}
                        {service.fields.map((f) => {
                          const tf = (t.workspace.book.serviceFields as Record<string, { label: string; placeholder?: string }>)[f.key];
                          return (
                          <Field key={f.key} label={tf?.label ?? f.label} required={f.required}>
                            {f.type === "textarea" ? (
                              <Textarea name={`detail_${f.key}`} required={f.required} placeholder={tf?.placeholder ?? f.placeholder} />
                            ) : (
                              <Input
                                name={`detail_${f.key}`}
                                type={f.type}
                                required={f.required}
                                placeholder={tf?.placeholder ?? f.placeholder}
                              />
                            )}
                          </Field>
                          );
                        })}
                        <Field label={t.workspace.book.fields.remark} className="sm:col-span-2">
                          <Textarea name="remark" placeholder={t.workspace.book.fields.remarkPlaceholder} />
                        </Field>
                      </div>

                      <StepHeading n="3" title={t.workspace.book.step3Title} desc={t.workspace.book.step3Desc} />
                      <p className="mb-4 text-[12.5px] leading-[1.8] text-[#8b95ad]">
                        {t.workspace.book.upload.hint(UPLOAD_LIMITS.maxFiles)}
                      </p>
                      <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#35a07a]/45 bg-gradient-to-b from-[#e9f5f0]/70 to-white px-5 py-9 text-center transition-all hover:border-[#35a07a]/70 hover:shadow-[0_8px_24px_rgba(42,148,112,0.12)]">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#4cb896] to-[#2a9470] text-white shadow-[0_6px_16px_rgba(53,160,122,0.35)]">
                          <UploadCloud size={22} aria-hidden="true" />
                        </span>
                        <span className="text-[13.5px] font-bold text-[#2a8163]">{t.workspace.book.upload.clickChoose}</span>
                        <span className="text-[11.5px] text-[#8b95ad]">{t.workspace.book.upload.types}</span>
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
                                aria-label={t.workspace.book.upload.removeFile(f.name)}
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
                            {t.workspace.book.upload.totalSize((totalSize / 1024 / 1024).toFixed(1))}
                          </li>
                        </ul>
                      )}

                      {/* 機票 / 行程單（接機類服務必傳） */}
                      {needsTicket && (
                        <div className="mt-5">
                          <h3 className="mb-2 text-[14px] font-bold text-[#161b2e]">{t.workspace.book.ticket.title}</h3>
                          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-[#35a07a]/35 bg-[#e9f5f0]/40 px-5 py-4 transition-colors hover:border-[#35a07a]/60">
                            <span className="min-w-0 truncate text-[13px] text-[#3d4763]">
                              {ticket ? ticket.name : t.workspace.book.ticket.pick}
                            </span>
                            {ticket ? (
                              <button
                                type="button"
                                aria-label={t.workspace.book.ticket.remove}
                                className="shrink-0 cursor-pointer text-[#8b95ad] transition-colors hover:text-red-600"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setTicket(null);
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            ) : (
                              <UploadCloud size={20} className="shrink-0 text-[#35a07a]" aria-hidden="true" />
                            )}
                            <input
                              ref={ticketInputRef}
                              type="file"
                              accept={UPLOAD_LIMITS.accept}
                              className="hidden"
                              onChange={(e) => onPickTicket(e.target.files?.[0] || null)}
                            />
                          </label>
                        </div>
                      )}

                      {state.phase === "error" && (
                        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-600">
                          {state.message}
                        </p>
                      )}

                      <Button type="submit" size="lg" className="mt-7 w-full" loading={state.phase === "submitting"}>
                        {t.workspace.book.submit}
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
        title={t.workspace.cancelModal.title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              {t.workspace.cancelModal.back}
            </Button>
            <Button variant="danger" onClick={() => void cancelBooking()} loading={cancelling}>
              {t.workspace.cancelModal.confirm}
            </Button>
          </>
        }
      >
        {cancelTarget && (
          <>
            <p className="text-[14px] leading-[1.8] text-[#5d6b85]">
              {t.workspace.cancelModal.bodyBefore}
              <strong className="text-[#161b2e]">{cancelTarget.order_no}</strong>
              {t.workspace.cancelModal.bodyAfter(svcLabelOf(cancelTarget.service_label))}
            </p>
            {cancelError && <p className="mt-3 text-[13px] font-medium text-red-600">{cancelError}</p>}
          </>
        )}
      </Modal>

      {/* 面試連結已生成彈窗（創建後自動切到「面試記錄」分欄） */}
      <Modal
        open={createdIv !== null}
        onClose={() => {
          setCreatedIv(null);
          setCopied(false);
        }}
        title={t.workspace.linkModal.title}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                if (!createdIv) return;
                void navigator.clipboard.writeText(createdIv.link).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? t.workspace.linkModal.copied : t.workspace.linkModal.copy}
            </Button>
            <Button
              onClick={() => {
                setCreatedIv(null);
                setCopied(false);
              }}
            >
              {t.workspace.linkModal.goRecords}
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] leading-[1.8] text-[#5d6b85]">
          {t.workspace.linkModal.bodyBefore}
          <strong className="text-[#161b2e]">{t.workspace.linkModal.bodyStrong}</strong>
          {t.workspace.linkModal.bodyAfter}
        </p>
        <div className="mt-3 rounded-xl border border-[#e6e9f2] bg-[#f8f9fc] px-4 py-3 text-[12.5px] break-all text-[#3d4763]">
          {createdIv?.link}
        </div>
        <p className="mt-3 text-[12px] text-[#8b95ad]">{t.workspace.linkModal.hint}</p>
      </Modal>
    </div>
  );
}
