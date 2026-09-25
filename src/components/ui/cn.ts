/** 輕量 className 合併工具（過濾 falsy 值，無第三方依賴） */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
