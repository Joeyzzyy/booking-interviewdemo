"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  Smartphone,
  CalendarCheck,
  LogOut,
  CircleCheck,
  TriangleAlert,
} from "lucide-react";
import { Badge, Button, Field, Input, Modal } from "@/components/ui";
import { openLogin } from "@/components/auth/login-events";
import { useLanguage } from "@/lib/i18n";
import { apiErrorText } from "@/lib/i18n/api-errors";
import type { Channel } from "@/lib/booking/auth";

interface CustomerInfo {
  id: string;
  email: string | null;
  phone: string | null;
}

/** 綁定聯絡方式彈窗：輸入標識 → 發送驗證碼 → 校驗綁定 */
function BindModal({
  channel,
  open,
  onClose,
  onBound,
}: {
  channel: Channel;
  open: boolean;
  onClose: () => void;
  onBound: (customer: CustomerInfo) => void;
}) {
  const { t } = useLanguage();
  const ta = t.workspace.account;
  const channelLabel = channel === "email" ? ta.email : ta.phone;
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"input" | "code">("input");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState("");

  useEffect(() => {
    if (open) {
      setIdentifier("");
      setCode("");
      setStep("input");
      setError("");
      setDevCode("");
    }
  }, [open]);

  const sendCode = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/account/bind/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, identifier }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(apiErrorText(data, t) || ta.sendFailed);
        return;
      }
      setStep("code");
      if (data.devCode) setDevCode(data.devCode);
    } catch {
      setError(t.workspace.networkError);
    } finally {
      setBusy(false);
    }
  };

  const bind = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/account/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, identifier, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(apiErrorText(data, t) || ta.bindFailed);
        return;
      }
      onBound(data.customer);
      onClose();
    } catch {
      setError(t.workspace.networkError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ta.bindTitle(channelLabel)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t.header.cancel}
          </Button>
          {step === "input" ? (
            <Button onClick={() => void sendCode()} loading={busy} disabled={!identifier.trim()}>
              {ta.sendCode}
            </Button>
          ) : (
            <Button onClick={() => void bind()} loading={busy} disabled={code.length !== 6}>
              {ta.confirmBind}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={channelLabel} required>
          <Input
            type={channel === "email" ? "email" : "tel"}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={step === "code"}
            placeholder={channel === "email" ? "you@example.com" : "9123 4567"}
          />
        </Field>
        {step === "code" && (
          <>
            <Field label={ta.codeLabel} required hint={ta.codeHint(identifier)}>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder={ta.codePlaceholder}
                autoFocus
              />
            </Field>
            {devCode && (
              <p className="rounded-xl bg-[#e9f5f0] px-4 py-2.5 text-[12.5px] text-[#2a8163]">
                {ta.devCode(devCode)}
              </p>
            )}
          </>
        )}
        {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

/** 賬號中心：賬戶資料 / 聯絡方式綁定管理 / 快速入口 */
export default function AccountClient() {
  const router = useRouter();
  const { t } = useLanguage();
  const ta = t.workspace.account;
  const channelLabel = (c: Channel) => (c === "email" ? ta.email : ta.phone);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [checked, setChecked] = useState(false);
  const [bindChannel, setBindChannel] = useState<Channel | null>(null);
  const [unbindTarget, setUnbindTarget] = useState<Channel | null>(null);
  const [unbinding, setUnbinding] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setCustomer(data.customer);
    } catch {
      setCustomer(null);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    void loadMe();
    const onAuthChanged = () => void loadMe();
    window.addEventListener("nl-auth-changed", onAuthChanged);
    return () => window.removeEventListener("nl-auth-changed", onAuthChanged);
  }, [loadMe]);

  // 未登入：自動彈出登入框
  useEffect(() => {
    if (checked && !customer) openLogin();
  }, [checked, customer]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.dispatchEvent(new Event("nl-auth-changed"));
    router.push("/");
    router.refresh();
  };

  const unbind = async () => {
    if (!unbindTarget) return;
    setUnbinding(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/unbind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: unbindTarget }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ ok: false, text: apiErrorText(data, t) || ta.unbindFailed });
        return;
      }
      setCustomer(data.customer);
      setNotice({ ok: true, text: ta.unboundOk(channelLabel(unbindTarget)) });
      setUnbindTarget(null);
      window.dispatchEvent(new Event("nl-auth-changed"));
    } catch {
      setNotice({ ok: false, text: t.workspace.networkError });
    } finally {
      setUnbinding(false);
    }
  };

  if (!checked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[14px] text-[#8b95ad]">
        {t.workspace.loading}
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-[#161b2e]">{ta.title}</h1>
        <p className="mt-3 text-[14px] leading-[1.85] text-[#5d6b85]">
          {ta.loginHint}
        </p>
        <Button size="lg" className="mt-6" onClick={() => openLogin("/account")}>
          {t.header.login}
        </Button>
      </div>
    );
  }

  const rows: { channel: Channel; icon: typeof Mail; value: string | null }[] = [
    { channel: "email", icon: Mail, value: customer.email },
    { channel: "phone", icon: Smartphone, value: customer.phone },
  ];

  return (
    <div className="relative flex-1 px-6 py-14 sm:py-20">
      <div className="relative mx-auto max-w-[760px]">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold tracking-[-0.02em] text-[#161b2e]">{ta.title}</h1>
            <p className="mt-1.5 text-[13.5px] text-[#5d6b85]">{ta.subtitle}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setLogoutOpen(true)}>
            <LogOut size={13} aria-hidden="true" />
            {t.header.logout}
          </Button>
        </div>

        {notice && (
          <p
            className={`mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] font-semibold ${
              notice.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
            }`}
          >
            {notice.ok ? <CircleCheck size={15} aria-hidden="true" /> : <TriangleAlert size={15} aria-hidden="true" />}
            {notice.text}
          </p>
        )}

        {/* 聯絡方式 */}
        <div className="glass-card p-7 sm:p-8">
          <h2 className="text-[16px] font-bold text-[#161b2e]">{ta.contactTitle}</h2>
          <p className="mt-1.5 text-[12.5px] leading-[1.75] text-[#8b95ad]">
            {ta.contactDesc}
          </p>

          <div className="mt-6 flex flex-col gap-4">
            {rows.map(({ channel, icon: Icon, value }) => {
              const bound = Boolean(value);
              const canUnbind = bound && Boolean(customer[channel === "email" ? "phone" : "email"]);
              return (
                <div
                  key={channel}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/70 px-5 py-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4cb896]/12 to-[#2a9470]/12 text-[#35a07a]">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-[#8b95ad]">{channelLabel(channel)}</p>
                    <p className="truncate text-[14.5px] font-bold text-[#161b2e]">
                      {value || ta.notBound}
                    </p>
                  </div>
                  <Badge variant={bound ? "green" : "gray"}>{bound ? ta.bound : ta.notBound}</Badge>
                  {channel === "phone" && !bound && (
                    <Badge variant="gray">Coming Soon</Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      variant={bound ? "outline" : "primary"}
                      size="sm"
                      disabled={channel === "phone" && !bound}
                      title={channel === "phone" && !bound ? ta.smsComingSoon : undefined}
                      onClick={() => setBindChannel(channel)}
                    >
                      {bound ? ta.change : ta.bind}
                    </Button>
                    {bound && (
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={!canUnbind}
                        title={canUnbind ? undefined : ta.keepOneHint}
                        onClick={() => setUnbindTarget(channel)}
                      >
                        {ta.unbind}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 快速入口 */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Link href="/booking?tab=orders" className="group">
            <div className="glass-card flex h-full items-center gap-4 p-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4cb896]/12 to-[#2a9470]/12 text-[#35a07a]">
                <CalendarCheck size={19} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-[15px] font-bold text-[#161b2e] group-hover:text-[#2a8163]">
                  {ta.bookingsEntryTitle}
                </h3>
                <p className="mt-1 text-[12.5px] text-[#8b95ad]">{ta.bookingsEntryDesc}</p>
              </div>
            </div>
          </Link>
          <div className="glass-card flex items-center gap-4 p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/[0.04] text-[#8b95ad]">
              <TriangleAlert size={19} aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-[15px] font-bold text-[#5d6b85]">{ta.closeAccountTitle}</h3>
              <p className="mt-1 text-[12.5px] leading-[1.7] text-[#8b95ad]">
                {ta.closeAccountDesc}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 綁定彈窗 */}
      {bindChannel && (
        <BindModal
          channel={bindChannel}
          open
          onClose={() => setBindChannel(null)}
          onBound={(c) => {
            setCustomer(c);
            setNotice({ ok: true, text: ta.boundOk(channelLabel(bindChannel)) });
            window.dispatchEvent(new Event("nl-auth-changed"));
          }}
        />
      )}

      {/* 解綁確認彈窗 */}
      <Modal
        open={unbindTarget !== null}
        onClose={() => !unbinding && setUnbindTarget(null)}
        title={unbindTarget ? ta.unbindTitle(channelLabel(unbindTarget)) : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setUnbindTarget(null)} disabled={unbinding}>
              {ta.back}
            </Button>
            <Button variant="danger" onClick={() => void unbind()} loading={unbinding}>
              {ta.confirmUnbind}
            </Button>
          </>
        }
      >
        {unbindTarget && (
          <p className="text-[14px] leading-[1.8] text-[#5d6b85]">
            {ta.unbindBodyBefore}
            <strong className="text-[#161b2e]">{customer[unbindTarget]}</strong>
            {ta.unbindBodyAfter(
              channelLabel(unbindTarget === "email" ? "phone" : "email"),
              customer[unbindTarget === "email" ? "phone" : "email"] || ""
            )}
          </p>
        )}
      </Modal>

      {/* 登出確認彈窗 */}
      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title={t.header.logoutTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLogoutOpen(false)}>
              {t.header.cancel}
            </Button>
            <Button variant="danger" onClick={() => void logout()}>
              {t.header.confirmLogout}
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-[1.8] text-[#5d6b85]">
          {t.header.logoutHint}
        </p>
      </Modal>
    </div>
  );
}
