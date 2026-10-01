import sanitizeHtml from "sanitize-html";

/** 帖子內容白名單：只保留排版標籤 + 連結 + 圖片（防 XSS）。發帖 / 編輯共用 */
export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "strong", "b", "em", "i", "u", "s",
      "ul", "ol", "li", "blockquote", "a", "img", "figure", "figcaption",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "style"],
      figure: ["style"],
    },
    // 尺寸只准 width/height 嘅 px 或 % 值（編輯器拖拽調大小會寫入 style）
    allowedStyles: {
      "*": {
        width: [/^\d+(?:\.\d+)?(?:px|%)$/],
        height: [/^\d+(?:\.\d+)?(?:px|%)$/],
      },
    },
    allowedSchemes: ["https", "http"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}

/** 去標籤取純文本（長度校驗用） */
export function plainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();
}
