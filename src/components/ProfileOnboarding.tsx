"use client";

import { useRef, useState } from "react";
import { UploadCloud, Trash2 } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";

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
  const [idCard, setIdCard] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = (f: File | null) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      setError("身份證檔案超過 4MB 上限，請壓縮或截圖後再上傳");
      return;
    }
    setError("");
    setIdCard(f);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!idCard) {
      setError("請上傳身份證照片");
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
        setError(data.error || "提交失敗，請稍後再試");
        return;
      }
      onDone();
    } catch {
      setError("網絡錯誤，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex flex-1 items-center justify-center px-6 py-16">
      <div className="card relative w-full max-w-[520px] p-8 sm:p-10">
        <h1 className="text-[22px] font-bold text-[#161b2e]">完善申請資料</h1>
        <p className="mt-2 text-[13.5px] leading-[1.8] text-[#5d6b85]">
          首次使用請補全以下資料，完成後即可購買套票及提交預約。
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 flex flex-col gap-4">
          {rejectReason && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] leading-[1.8] font-semibold text-red-600">
              上次提交未通過審核：{rejectReason}
              <br />
              請按上述原因修改後重新提交。
            </p>
          )}
          <Field label="申請人姓名" required>
            <Input name="applicantName" required placeholder="申請人全名" defaultValue={initial?.applicantName || ""} />
          </Field>
          <Field label="公司名稱" required>
            <Input name="companyName" required placeholder="僱傭中心 / 公司全名" defaultValue={initial?.companyName || ""} />
          </Field>
          <Field label="勞工處登記編號" required>
            <Input name="labourRegNo" required placeholder="例如：12345" defaultValue={initial?.labourRegNo || ""} />
          </Field>

          <Field label="身份證照片" required hint="JPG / PNG / PDF，≤ 4MB">
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-[#35a07a]/35 bg-[#e9f5f0]/40 px-5 py-4 transition-colors hover:border-[#35a07a]/60">
              <span className="min-w-0 truncate text-[13px] text-[#3d4763]">
                {idCard ? idCard.name : "點擊上傳身份證照片"}
              </span>
              {idCard ? (
                <button
                  type="button"
                  aria-label="移除身份證"
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
            提交並開始使用
          </Button>
        </form>
      </div>
    </div>
  );
}
