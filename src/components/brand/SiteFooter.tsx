import Link from "next/link";
import Logo from "./Logo";
import { brand, contact } from "@/lib/brand";

/** 站點頁腳：僅首頁使用（功能區 /booking、/account 不顯示） */
export default function SiteFooter() {
  return (
    <footer className="border-t border-[#e6e9f2] bg-white px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="flex min-w-0 flex-col gap-3">
            <Logo size={34} wordmarkSize={16} />
            <p className="max-w-[300px] text-[12.5px] leading-[1.75] text-[#8b95ad]">
              連結僱主與工人，一站式服務安排——陪同驗身、工人接機、AI 視頻面試。
            </p>
          </div>

          <nav aria-label="快速連結" className="flex flex-col gap-2.5 text-[13px]">
            <p className="text-[11px] font-bold tracking-[0.18em] text-[#8b95ad]">快速連結</p>
            <Link href="/booking" className="font-semibold text-black/50 transition-colors hover:text-[#2a8163]">
              服務預約
            </Link>
            <Link href="/account" className="font-semibold text-black/50 transition-colors hover:text-[#2a8163]">
              賬號中心
            </Link>
            <a href="/#interview" className="font-semibold text-black/50 transition-colors hover:text-[#2a8163]">
              AI 視頻面試
            </a>
          </nav>

          <div className="flex flex-col gap-2.5 text-[13px]">
            <p className="text-[11px] font-bold tracking-[0.18em] text-[#8b95ad]">聯絡</p>
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
            © {new Date().getFullYear()} {brand.nameFull}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
