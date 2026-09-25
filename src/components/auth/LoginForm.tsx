"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Smartphone, ArrowLeft } from "lucide-react";
import { Button, Field, Input, Tabs } from "@/components/ui";

type Channel = "email" | "phone";

/**
 * 登入 / 註冊表單（可嵌入彈窗或頁面）：
 * 電郵或手機短訊驗證碼，首次登入即自動開戶。
 */
export default function LoginForm({
  next,
  onSuccess,
}: {
  /** 登入成功後跳轉（不傳則留在當前頁，僅通知登入態更新） */
  next?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();

  const [channel, setChannel] = useState<Channel>("email");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"input" | "code">("input");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const switchChannel = (c: Channel) => {
    setChannel(c);
    setStep("input");
    setIdentifier("");
    setCode("");
    setDevCode("");
    setError("");
  };

  const sendCode = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/send-code", {
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
      setCountdown(60);
      if (data.devCode) setDevCode(data.devCode);
    } catch {
      setError("網絡錯誤，請稍後再試");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, identifier, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "驗證失敗");
        return;
      }
      window.dispatchEvent(new Event("nl-auth-changed"));
      onSuccess?.();
      if (next) {
        router.push(next);
        router.refresh();
      }
    } catch {
      setError("網絡錯誤，請稍後再試");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "input") void sendCode();
        else void verify();
      }}
    >
      <Tabs
        active={channel}
        onChange={(k) => switchChannel(k as Channel)}
        items={[
          { key: "email", label: "電郵驗證碼", icon: <Mail size={14} aria-hidden="true" /> },
          {
            key: "phone",
            label: "手機短訊（Coming Soon）",
            icon: <Smartphone size={14} aria-hidden="true" />,
            disabled: true,
            disabledHint: "短訊登入即將開放，請先使用電郵登入",
          },
        ]}
      />

      <Field
        label={channel === "email" ? "電郵地址" : "手機號碼"}
        required
        hint={channel === "phone" ? "香港號碼可直接輸入 8 位數字，系統自動補 +852" : undefined}
      >
        <Input
          type={channel === "email" ? "email" : "tel"}
          inputMode={channel === "phone" ? "tel" : undefined}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={step === "code"}
          required
          placeholder={channel === "email" ? "you@example.com" : "9123 4567"}
          icon={channel === "email" ? <Mail size={15} /> : <Smartphone size={15} />}
        />
      </Field>

      {step === "code" && (
        <>
          <Field label="驗證碼" required>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoFocus
              placeholder="6 位數字"
            />
          </Field>
          {devCode && (
            <p className="rounded-xl bg-[#e9f5f0] px-4 py-2.5 text-[12.5px] text-[#2a8163]">
              開發模式：驗證碼為 <strong className="tracking-widest">{devCode}</strong>（未配置發送服務）
            </p>
          )}
        </>
      )}

      {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}

      <Button type="submit" size="lg" loading={busy} className="w-full">
        {step === "input" ? "發送驗證碼" : "登入"}
      </Button>

      {step === "code" && (
        <div className="flex items-center justify-between text-[12.5px]">
          <button
            type="button"
            onClick={() => {
              setStep("input");
              setCode("");
              setDevCode("");
              setError("");
            }}
            className="inline-flex cursor-pointer items-center gap-1 font-semibold text-[#5d6b85] hover:text-[#161b2e]"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            換一個{channel === "email" ? "電郵" : "號碼"}
          </button>
          <button
            type="button"
            disabled={countdown > 0 || busy}
            onClick={() => void sendCode()}
            className="cursor-pointer font-semibold text-[#35a07a] disabled:cursor-not-allowed disabled:text-[#8b95ad]"
          >
            {countdown > 0 ? `${countdown} 秒後可重發` : "重新發送"}
          </button>
        </div>
      )}
    </form>
  );
}
