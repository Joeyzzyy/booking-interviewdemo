"use client";

import Link from "next/link";
import Logo from "./Logo";
import { brand, contact } from "@/lib/brand";
import { useLanguage } from "@/lib/i18n";

/** 站點頁腳：僅首頁使用（功能區 /booking、/account 不顯示） */
export default function SiteFooter() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-[#e6e9f2] bg-white px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="flex min-w-0 flex-col gap-3">
            <Logo size={34} wordmarkSize={16} />
            <p className="max-w-[300px] text-[12.5px] leading-[1.75] text-[#8b95ad]">
              {t.footer.tagline}
            </p>
          </div>

          <nav aria-label={t.footer.quickLinks} className="flex flex-col gap-2.5 text-[13px]">
            <p className="text-[11px] font-bold tracking-[0.18em] text-[#8b95ad]">{t.footer.quickLinks}</p>
            <Link href="/booking" className="font-semibold text-black/50 transition-colors hover:text-[#2a8163]">
              {t.footer.booking}
            </Link>
            <Link href="/account" className="font-semibold text-black/50 transition-colors hover:text-[#2a8163]">
              {t.footer.account}
            </Link>
            <a href="/#interview" className="font-semibold text-black/50 transition-colors hover:text-[#2a8163]">
              {t.footer.interview}
            </a>
          </nav>

          <div className="flex flex-col gap-2.5 text-[13px]">
            <p className="text-[11px] font-bold tracking-[0.18em] text-[#8b95ad]">{t.footer.contact}</p>
            <a
              href={`mailto:${contact.email}`}
              className="font-semibold text-black/50 transition-colors hover:text-[#2a8163]"
            >
              {contact.email}
            </a>
            <span className="font-semibold text-black/50">{contact.phone}</span>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-[#e6e9f2] pt-6">
          <p className="text-[12px] text-black/30">
            © {new Date().getFullYear()} {brand.nameFull}. {t.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
