import type { Messages } from "./dictionaries";

/**
 * API 錯誤文案：伺服器返回穩定 code 時優先用當前語言翻譯（workspace.apiErrors），
 * 冇 code 或 code 未識別就顯示原文 error（zh-Hant 兜底）。
 */
export function apiErrorText(data: unknown, t: Messages): string {
  if (!data || typeof data !== "object") return "";
  const d = data as { code?: string; error?: string };
  if (d.code) {
    const map = t.workspace.apiErrors as Record<string, string>;
    if (map[d.code]) return map[d.code];
  }
  return d.error || "";
}
