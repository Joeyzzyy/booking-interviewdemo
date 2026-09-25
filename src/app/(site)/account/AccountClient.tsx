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
import type { Channel } from "@/lib/booking/auth";

interface CustomerInfo {
  id: string;
  email: string | null;
  phone: string | null;
}

const CHANNEL_LABEL: Record<Channel, string> = { email: "電郵", phone: "手機號" };

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
        setError(data.error || "發送失敗");
        return;
      }
      setStep("code");
      if (data.devCode) setDevCode(data.devCode);
    } catch {
      setError("網絡錯誤，請稍後再試");
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
        setError(data.error || "綁定失敗");
        return;
      }
      onBound(data.customer);
      onClose();
    } catch {
      setError("網絡錯誤，請稍後再試");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`綁定${CHANNEL_LABEL[channel]}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            取消
          </Button>
          {step === "input" ? (
            <Button onClick={() => void sendCode()} loading={busy} disabled={!identifier.trim()}>
              發送驗證碼
            </Button>
          ) : (
            <Button onClick={() => void bind()} loading={busy} disabled={code.length !== 6}>
              確認綁定
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={CHANNEL_LABEL[channel]} required>
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
            <Field label="驗證碼" required hint={`驗證碼已發送至 ${identifier}，10 分鐘內有效`}>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6 位數字"
                autoFocus
              />
            </Field>
            {devCode && (
              <p className="rounded-xl bg-[#e9f5f0] px-4 py-2.5 text-[12.5px] text-[#2a8163]">
                開發模式：驗證碼為 <strong className="tracking-widest">{devCode}</strong>
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
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [checked, setChecked] = useState(false);
  const [bindChannel, setBindChannel] = useState<Channel | null>(null);
  const [unbindTarget, setUnbindTarget] = useState<Channel | null>(null);
  const [unbinding, setUnbinding] = useState(false);
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
        setNotice({ ok: false, text: data.error || "解綁失敗" });
        return;
      }
      setCustomer(data.customer);
      setNotice({ ok: true, text: `${CHANNEL_LABEL[unbindTarget]}已解綁。` });
      setUnbindTarget(null);
      window.dispatchEvent(new Event("nl-auth-changed"));
    } catch {
      setNotice({ ok: false, text: "網絡錯誤，請稍後再試" });
    } finally {
      setUnbinding(false);
    }
  };

  if (!checked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[14px] text-[#8b95ad]">
        載入中…
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-[#161b2e]">賬號中心</h1>
        <p className="mt-3 text-[14px] leading-[1.85] text-[#5d6b85]">
          登入後即可管理你的聯絡方式與預約紀錄。
        </p>
        <Button size="lg" className="mt-6" onClick={() => openLogin("/account")}>
          登入 / 註冊
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
            <h1 className="text-[26px] font-bold tracking-[-0.02em] text-[#161b2e]">賬號中心</h1>
            <p className="mt-1.5 text-[13.5px] text-[#5d6b85]">管理你的聯絡方式與賬戶設定</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void logout()}>
            <LogOut size={13} aria-hidden="true" />
            登出
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
          <h2 className="text-[16px] font-bold text-[#161b2e]">聯絡方式</h2>
          <p className="mt-1.5 text-[12.5px] leading-[1.75] text-[#8b95ad]">
            電郵與手機號均可用於驗證碼登入。賬戶必須至少保留一種聯絡方式，暫不支援註銷賬戶。
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
                    <p className="text-[12px] font-semibold text-[#8b95ad]">{CHANNEL_LABEL[channel]}</p>
                    <p className="truncate text-[14.5px] font-bold text-[#161b2e]">
                      {value || "未綁定"}
                    </p>
                  </div>
                  <Badge variant={bound ? "green" : "gray"}>{bound ? "已綁定" : "未綁定"}</Badge>
                  {channel === "phone" && !bound && (
                    <Badge variant="gray">Coming Soon</Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      variant={bound ? "outline" : "primary"}
                      size="sm"
                      disabled={channel === "phone" && !bound}
                      title={channel === "phone" && !bound ? "短訊驗證即將開放" : undefined}
                      onClick={() => setBindChannel(channel)}
                    >
                      {bound ? "更換" : "綁定"}
                    </Button>
                    {bound && (
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={!canUnbind}
                        title={canUnbind ? undefined : "賬戶必須至少保留一種聯絡方式"}
                        onClick={() => setUnbindTarget(channel)}
                      >
                        解綁
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
                  我的預約與套票
                </h3>
                <p className="mt-1 text-[12.5px] text-[#8b95ad]">查看預約紀錄、套票餘額，發起新預約</p>
              </div>
            </div>
          </Link>
          <div className="glass-card flex items-center gap-4 p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/[0.04] text-[#8b95ad]">
              <TriangleAlert size={19} aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-[15px] font-bold text-[#5d6b85]">註銷賬戶</h3>
              <p className="mt-1 text-[12.5px] leading-[1.7] text-[#8b95ad]">
                暫不支援自助註銷；如有需要請聯絡客服處理。
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
            setNotice({ ok: true, text: `${CHANNEL_LABEL[bindChannel]}綁定成功。` });
            window.dispatchEvent(new Event("nl-auth-changed"));
          }}
        />
      )}

      {/* 解綁確認彈窗 */}
      <Modal
        open={unbindTarget !== null}
        onClose={() => !unbinding && setUnbindTarget(null)}
        title={unbindTarget ? `解綁${CHANNEL_LABEL[unbindTarget]}？` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setUnbindTarget(null)} disabled={unbinding}>
              返回
            </Button>
            <Button variant="danger" onClick={() => void unbind()} loading={unbinding}>
              確定解綁
            </Button>
          </>
        }
      >
        {unbindTarget && (
          <p className="text-[14px] leading-[1.8] text-[#5d6b85]">
            解綁後，<strong className="text-[#161b2e]">{customer[unbindTarget]}</strong> 將不能再用於登入此賬戶；
            你仍可使用{CHANNEL_LABEL[unbindTarget === "email" ? "phone" : "email"]}
            （{customer[unbindTarget === "email" ? "phone" : "email"]}）登入。
          </p>
        )}
      </Modal>
    </div>
  );
}
