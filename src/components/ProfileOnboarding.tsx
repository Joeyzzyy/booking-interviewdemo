"use client";

import { useRef, useState } from "react";
import { UploadCloud, Trash2 } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { useLanguage } from "@/lib/i18n";

/**
 * 註冊資料補全：申請人姓名 / 公司名稱 / 勞工處登記編號 / 身份證照片。
 * 登入後未補全時擋在功能頁之前，提交成功後調 onDone() 重新載入。
 */
export default function ProfileOnboarding({
  onDone,
  rejectReason,
  initial,
}: {
  onDone: () => void;
  rejectReason?: string | null;
  initial?: { applicantName?: string | null; companyName?: string | null; labourRegNo?: string | null };
}) {
  const { t } = useLanguage();
  const [idCard, setIdCard] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = (f: File | null) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      setError(t.workspace.onboarding.idCardTooLarge);
      return;
    }
    setError("");
    setIdCard(f);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!idCard) {
      setError(t.workspace.onboarding.idCardRequired);
      return;
    }
    setSubmitting(true);
    setError("");
    const form = new FormData(e.currentTarget);
    form.set("idCard", idCard);
    try {
      const res = await fetch("/api/auth/complete-profile", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t.workspace.submitFailed);
        return;
      }
      onDone();
    } catch {
      setError(t.workspace.networkError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex flex-1 items-center justify-center px-6 py-16">
      <div className="card relative w-full max-w-[520px] p-8 sm:p-10">
        <h1 className="text-[22px] font-bold text-[#161b2e]">{t.workspace.onboarding.title}</h1>
        <p className="mt-2 text-[13.5px] leading-[1.8] text-[#5d6b85]">
          {t.workspace.onboarding.intro}
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 flex flex-col gap-4">
          {rejectReason && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] leading-[1.8] font-semibold text-red-600">
              {t.workspace.onboarding.rejectBanner}{rejectReason}
              <br />
              {t.workspace.onboarding.rejectHint}
            </p>
          )}
          <Field label={t.workspace.onboarding.applicantName} required>
            <Input name="applicantName" required placeholder={t.workspace.onboarding.applicantNamePlaceholder} defaultValue={initial?.applicantName || ""} />
          </Field>
          <Field label={t.workspace.onboarding.companyName} required>
            <Input name="companyName" required placeholder={t.workspace.onboarding.companyNamePlaceholder} defaultValue={initial?.companyName || ""} />
          </Field>
          <Field label={t.workspace.onboarding.labourRegNo} required>
            <Input name="labourRegNo" required placeholder={t.workspace.onboarding.labourRegNoPlaceholder} defaultValue={initial?.labourRegNo || ""} />
          </Field>

          <Field label={t.workspace.onboarding.idCard} required hint={t.workspace.onboarding.idCardHint}>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-[#35a07a]/35 bg-[#e9f5f0]/40 px-5 py-4 transition-colors hover:border-[#35a07a]/60">
              <span className="min-w-0 truncate text-[13px] text-[#3d4763]">
                {idCard ? idCard.name : t.workspace.onboarding.idCardPick}
              </span>
              {idCard ? (
                <button
                  type="button"
                  aria-label={t.workspace.onboarding.idCardRemove}
                  className="shrink-0 cursor-pointer text-[#8b95ad] transition-colors hover:text-red-600"
                  onClick={(e) => {
                    e.preventDefault();
                    setIdCard(null);
                  }}
                >
                  <Trash2 size={15} />
                </button>
              ) : (
                <UploadCloud size={20} className="shrink-0 text-[#35a07a]" aria-hidden="true" />
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={(e) => onPick(e.target.files?.[0] || null)}
              />
            </label>
          </Field>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" loading={submitting} className="mt-2 w-full">
            {t.workspace.onboarding.submit}
          </Button>
        </form>
      </div>
    </div>
  );
}
