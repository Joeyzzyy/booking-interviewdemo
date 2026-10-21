"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui";
import { useLanguage } from "@/lib/i18n";
import { INTERVIEW_PLANS } from "@/lib/interview/plans";

interface SubscriptionInfo {
  plan: "basic" | "advanced";
  status: "active" | "canceling" | "canceled";
  currentPeriodEnd: string;
}

const PLAN_KEYS = ["basic", "advanced"] as const;

/** AI 面試訂閱面板：無訂閱顯示方案卡片，有訂閱顯示狀態 + 升級/取消 */
export default function SubscriptionPanel({ onChanged }: { onChanged?: () => void }) {
  const { t } = useLanguage();
  const ts = t.workspace.subscription;
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<"success" | "cancelled" | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/subscription", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSub(data.subscription || null);
        setActive(Boolean(data.active));
      }
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void load();
    // Stripe 訂閱付款回跳提示
    const params = new URLSearchParams(window.location.search);
    const q = params.get("sub");
    if (q === "success" || q === "cancelled") {
      setFlash(q);
      window.history.replaceState(null, "", window.location.pathname + (window.location.search.replace(/[?&]sub=(success|cancelled)/, "").replace("?&", "?")));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const subscribe = async (plan: "basic" | "advanced") => {
    setBusy(`sub-${plan}`);
    setError("");
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || ts.error);
        return;
      }
      window.location.assign(data.url); // 跳轉 Stripe 付款頁
    } catch {
      setError(ts.error);
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (!window.confirm(ts.cancelConfirm)) return;
    setBusy("cancel");
    setError("");
    try {
      const res = await fetch("/api/subscription", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || ts.error);
        return;
      }
      await load();
      onChanged?.();
    } catch {
      setError(ts.error);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <p className="rounded-2xl border border-black/[0.06] bg-white px-5 py-8 text-center text-[13px] text-[#8b95ad]">{ts.loading}</p>;
  }

  return (
    <div>
      {flash && (
        <p
          className={`mb-5 rounded-xl px-4 py-3 text-[13px] font-semibold ${
            flash === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {flash === "success" ? ts.successFlash : ts.cancelledFlash}
        </p>
      )}
      {error && (
        <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-600">{error}</p>
      )}

      {/* 當前訂閱狀態 */}
      {sub && active && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-[#35a07a]/30 bg-gradient-to-r from-[#e9f5f0] to-white px-5 py-4">
          <span className="rounded-full bg-gradient-to-br from-[#4cb896] to-[#2a9470] px-3 py-1 text-[12px] font-extrabold text-white">
            {sub.plan === "advanced" ? ts.advancedName : ts.basicName}
          </span>
          <span className="text-[13px] text-[#3d4763]">
            {ts.renewAt(new Date(sub.currentPeriodEnd).toLocaleDateString())}
            {sub.status === "canceling" ? `（${ts.canceling}）` : ""}
          </span>
          {sub.status === "active" && (
            <Button variant="outline" size="sm" className="ml-auto" loading={busy === "cancel"} onClick={() => void cancel()}>
              {ts.cancel}
            </Button>
          )}
        </div>
      )}

      <p className="mb-5 max-w-[720px] text-[13px] leading-[1.85] text-[#5d6b85]">{ts.subtitle}</p>

      {/* 方案卡片 */}
      <div className="grid gap-4 sm:grid-cols-2">
        {PLAN_KEYS.map((key) => {
          const isCurrent = sub && active && sub.plan === key;
          const isDowngrade = sub && active && sub.plan === "advanced" && key === "basic";
          const features = key === "advanced" ? ts.advancedFeatures : ts.basicFeatures;
          return (
            <div
              key={key}
              className={`flex flex-col rounded-2xl border p-6 ${
                isCurrent ? "border-[#35a07a]/40 bg-gradient-to-b from-[#e9f5f0]/70 to-white" : "border-[#e6e9f2] bg-white"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <strong className="text-[16px] text-[#161b2e]">
                  {key === "advanced" ? ts.advancedName : ts.basicName}
                </strong>
                <span className="text-[12px] font-semibold text-[#8b95ad]">
                  {key === "advanced" ? ts.advancedTagline : ts.basicTagline}
                </span>
              </div>
              <p className="mt-2 text-[22px] font-extrabold text-[#2a8163]">
                HK${INTERVIEW_PLANS[key].priceHkd}
                <span className="ml-1 text-[13px] font-semibold text-[#8b95ad]">{ts.perMonth}</span>
              </p>
              <ul className="mt-4 flex flex-col gap-2">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] leading-[1.7] text-[#5d6b85]">
                    <Check size={14} className="mt-1 shrink-0 text-[#35a07a]" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-5">
                {isCurrent ? (
                  <span className="block rounded-xl bg-black/[0.04] py-2.5 text-center text-[13px] font-bold text-[#8b95ad]">
                    {ts.current}
                  </span>
                ) : (
                  <Button
                    className="w-full"
                    variant={key === "advanced" ? "primary" : "outline"}
                    loading={busy === `sub-${key}`}
                    disabled={Boolean(isDowngrade)}
                    onClick={() => void subscribe(key)}
                  >
                    {sub && active ? ts.upgrade : ts.subscribe}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {sub && active && sub.plan === "basic" && (
        <p className="mt-4 text-[12.5px] text-[#8b95ad]">{ts.basicOnlyHint}</p>
      )}
    </div>
  );
}
