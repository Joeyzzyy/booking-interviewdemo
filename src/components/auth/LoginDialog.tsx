"use client";

import { Modal } from "@/components/ui";
import LoginForm from "./LoginForm";

/** 登入 / 註冊彈窗 */
export default function LoginDialog({
  open,
  next,
  onClose,
}: {
  open: boolean;
  next?: string;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="登入 / 註冊" widthClassName="max-w-[440px]">
      <p className="mb-5 text-[13px] leading-[1.8] text-[#5d6b85]">
        選擇一種方式取得 6 位驗證碼，首次登入即自動建立賬戶。
      </p>
      <LoginForm next={next} onSuccess={onClose} />
    </Modal>
  );
}
