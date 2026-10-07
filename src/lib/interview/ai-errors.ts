/**
 * AI 服務（MiniMax / Gemini / Gemini TTS / STT）錯誤分類與友善提示。
 *
 * 原則：任何 AI 調用失敗都要——
 * 1. 對用戶友善：講清楚「發生咩事 + 點算」（key 類錯誤必須透出，唔可以靜靜吞掉）
 * 2. 保留詳情：環節 / 模型 / HTTP 狀態碼 / 上游錯誤原文，
 *    方便用戶截圖俾開發者定位問題。
 */

export type AiErrorKind =
  | "KEY_MISSING" // 環境變量未配置
  | "KEY_INVALID" // key 無效 / 過期 / 無權限
  | "QUOTA" // 額度用盡 / 觸發限流
  | "MODEL_UNAVAILABLE" // 模型不存在 / 下架 / 地區不可用
  | "NETWORK" // 網絡層失敗（fetch 直接拋異常）
  | "PARSE" // 上游返回內容解析失敗
  | "UPSTREAM"; // 其他上游錯誤（5xx 等）

export class AiServiceError extends Error {
  readonly kind: AiErrorKind;
  readonly provider: string;
  readonly status?: number;
  readonly model?: string;
  /** 上游返回原文（已截斷），僅作診斷用 */
  readonly detail?: string;

  constructor(init: {
    message: string;
    kind: AiErrorKind;
    provider: string;
    status?: number;
    model?: string;
    detail?: string;
  }) {
    super(init.message);
    this.name = "AiServiceError";
    this.kind = init.kind;
    this.provider = init.provider;
    this.status = init.status;
    this.model = init.model;
    this.detail = init.detail;
  }
}

/** 屬於「key 相關」的錯誤：必須透出俾用戶/管理員 */
export function isKeyError(e: unknown): boolean {
  return (
    e instanceof AiServiceError &&
    (e.kind === "KEY_MISSING" || e.kind === "KEY_INVALID" || e.kind === "QUOTA")
  );
}

const KIND_MESSAGE: Record<AiErrorKind, { title: string; advice: string }> = {
  KEY_MISSING: {
    title: "AI 服務未配置：缺少 API Key",
    advice: "請聯絡管理員檢查伺服器環境變量（GEMINI_API_KEY 等）是否已設定。",
  },
  KEY_INVALID: {
    title: "AI 服務驗證失敗：API Key 無效或已失效",
    advice: "請聯絡管理員檢查 Gemini API Key 是否填錯、過期或被撤銷，更新後重試。",
  },
  QUOTA: {
    title: "AI 服務額度已用盡或觸發限流",
    advice: "請聯絡管理員檢查賬單 / 配額，或稍後重試。",
  },
  MODEL_UNAVAILABLE: {
    title: "AI 模型暫時不可用",
    advice:
      "可能是模型名稱配置有誤，或 Google 已調整模型版本。請聯絡管理員檢查 GEMINI_MODEL 設定，稍後重試。",
  },
  NETWORK: {
    title: "連接 AI 服務失敗",
    advice: "網絡問題，請稍後重試；如持續出現請聯絡管理員。",
  },
  PARSE: {
    title: "AI 服務返回內容異常",
    advice: "可能是上游模型繁忙或返回格式異常，請稍後重試；如持續出現請聯絡管理員。",
  },
  UPSTREAM: {
    title: "AI 服務暫時不可用",
    advice: "上游服務出錯，請稍後重試；如持續出現請聯絡管理員。",
  },
};

/** 從 HTTP 錯誤響應分類（解析 Google / DeepSeek 錯誤體的 message） */
export function classifyHttpError(
  provider: string,
  status: number,
  bodyText: string,
  model?: string
): AiServiceError {
  let upstreamMessage = "";
  try {
    upstreamMessage = String(JSON.parse(bodyText)?.error?.message || "");
  } catch {
    // 非 JSON 響應（如代理 HTML 頁），用原文匹配
  }
  const blob = `${upstreamMessage} ${bodyText.slice(0, 300)}`;

  let kind: AiErrorKind = "UPSTREAM";
  if (status === 401 || status === 403) {
    kind = "KEY_INVALID";
  } else if (status === 429 || /quota|rate.?limit|resource.?exhausted|exhausted/i.test(blob)) {
    kind = "QUOTA";
  } else if (status === 404 || /no longer available/i.test(blob)) {
    kind = "MODEL_UNAVAILABLE";
  } else if (/api[_ -]?key[^a-z]{0,20}(not valid|invalid|expired)|invalid api[_ -]?key|missing api[_ -]?key/i.test(blob)) {
    kind = "KEY_INVALID";
  }

  return new AiServiceError({
    message: upstreamMessage || `HTTP ${status}`,
    kind,
    provider,
    status,
    model,
    detail: bodyText.slice(0, 300),
  });
}

export function missingKeyError(provider: string): AiServiceError {
  return new AiServiceError({
    message: `${provider} API Key 未配置`,
    kind: "KEY_MISSING",
    provider,
  });
}

export function networkError(provider: string, cause: unknown, model?: string): AiServiceError {
  return new AiServiceError({
    message: `連接 ${provider} 失敗：${cause instanceof Error ? cause.message : String(cause)}`,
    kind: "NETWORK",
    provider,
    model,
  });
}

export function parseError(provider: string, raw: string, model?: string): AiServiceError {
  return new AiServiceError({
    message: `${provider} 返回內容解析失敗`,
    kind: "PARSE",
    provider,
    model,
    detail: raw.slice(0, 300),
  });
}

/**
 * 生成給用戶看的完整錯誤訊息：
 * 前面是友善的一句話 + 建議，後面是「詳情」區塊（環節/模型/狀態碼/上游原文），方便截圖診斷。
 */
export function toUserMessage(e: unknown): string {
  if (e instanceof AiServiceError) {
    const { title, advice } = KIND_MESSAGE[e.kind];
    const lines = [
      `${title}。${advice}`,
      "",
      "──────── 詳情（請截圖俾管理員） ────────",
      `環節：${e.provider}${e.model ? `｜模型：${e.model}` : ""}${e.status ? `｜HTTP 狀態碼：${e.status}` : ""}`,
    ];
    if (e.detail) lines.push(`上游返回：${e.detail}`);
    else lines.push(`錯誤：${e.message}`);
    return lines.join("\n");
  }
  return `操作失敗：${e instanceof Error ? e.message : String(e)}`;
}
