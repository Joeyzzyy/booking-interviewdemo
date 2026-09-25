/** 觸發全局登入彈窗（由 LoginDialogProvider 監聽並渲染） */
export function openLogin(next?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("nl-open-login", { detail: { next } }));
}
