/**
 * 公共題庫種子腳本：《DOMESTIC HELPER CV DATA COLLECTION INTERVIEW FORM》72 題
 *
 * 用法：
 *   npm run seed:questions                 # 插入缺失題目 + 為缺譯文/音頻嘅題目生成資產
 *   npm run seed:questions -- --force      # 全部重新生成 5 語譯文 + TTS 音頻
 *   npm run seed:questions -- --limit 3    # 只處理前 3 題（試跑用）
 *
 * 需要 .env.local 配置：SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 * 以及 AI key（MINIMAX_API_KEY 或 GEMINI_API_KEY）用於翻譯 + TTS。
 *
 * 冪等：以「題目原文」匹配已有公共題（customer_id IS NULL），可反覆運行；
 * 已齊 5 語譯文 + 音頻嘅題目會自動跳過（斷點續跑）。
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// ─── 載入 .env.local / .env（動態 import 之前完成，模塊頂層會讀 env） ───
for (const file of [".env.local", ".env"]) {
  try {
    const content = readFileSync(resolve(process.cwd(), file), "utf-8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* 文件不存在則跳過 */
  }
}

const FORCE = process.argv.includes("--force");
const limitIdx = process.argv.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) || 0 : 0;

const LANGS = ["en", "id", "tl", "zh", "yue"] as const;

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("✗ 缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，請先配置 .env.local");
    process.exit(1);
  }
  if (!process.env.MINIMAX_API_KEY && !process.env.GEMINI_API_KEY) {
    console.warn("⚠ 未配置 MINIMAX_API_KEY / GEMINI_API_KEY：題目會入庫，但無法生成譯文同 TTS 音頻");
  }

  const { getSupabase } = await import("../src/lib/booking/db");
  const { generateQuestionAssets } = await import("../src/lib/interview/tts");
  const { SHARED_QUESTIONS } = await import("../src/lib/interview/shared-questions");

  const supabase = getSupabase();
  if (!supabase) {
    console.error("✗ Supabase 連接失敗");
    process.exit(1);
  }

  const queue = LIMIT > 0 ? SHARED_QUESTIONS.slice(0, LIMIT) : SHARED_QUESTIONS;
  console.log(`公共題庫種子：共 ${queue.length} 題${FORCE ? "（強制重新生成音頻）" : ""}\n`);

  // 已有公共題（customer_id IS NULL），按題目原文索引
  const { data: existingRows, error: loadErr } = await supabase
    .from("interview_questions")
    .select("id, question, category, sort_order, translations, audio")
    .is("customer_id", null);
  if (loadErr) {
    console.error("✗ 讀取已有題目失敗:", loadErr.message);
    process.exit(1);
  }
  const existing = new Map((existingRows || []).map((r) => [r.question as string, r]));

  let inserted = 0;
  let skipped = 0;
  let assetsOk = 0;
  let assetsFailed = 0;

  for (const [i, item] of queue.entries()) {
    const no = String(i + 1).padStart(2, " ");
    const short = item.question.length > 60 ? `${item.question.slice(0, 57)}…` : item.question;

    // 1) 確保題目入庫（含分類 + 排序）
    let id = existing.get(item.question)?.id as string | undefined;
    if (!id) {
      const { data, error } = await supabase
        .from("interview_questions")
        .insert({
          question: item.question,
          category: item.section,
          sort_order: i,
          customer_id: null,
        })
        .select("id")
        .single();
      if (error || !data) {
        console.error(`✗ [${no}] 插入失敗：${short}\n  ${error?.message}`);
        assetsFailed += 1;
        continue;
      }
      id = data.id as string;
      inserted += 1;
    } else {
      // 已存在：校正分類 / 排序 / 啟用狀態（唔郁譯文音頻）
      const row = existing.get(item.question)!;
      if (row.category !== item.section || row.sort_order !== i) {
        await supabase
          .from("interview_questions")
          .update({ category: item.section, sort_order: i, active: true })
          .eq("id", id);
      }
    }

    // 2) 檢查資產完整性（5 語譯文 + 5 語音頻），齊就跳過
    const row = existing.get(item.question);
    const translations = (row?.translations || {}) as Record<string, string>;
    const audio = (row?.audio || {}) as Record<string, string>;
    const complete =
      id && row && LANGS.every((l) => translations[l]) && LANGS.every((l) => audio[l]);
    if (complete && !FORCE) {
      skipped += 1;
      console.log(`– [${no}] 已齊全，跳過：${short}`);
      continue;
    }

    // 3) 生成 5 語譯文 + TTS 音頻
    process.stdout.write(`… [${no}] 生成譯文/音頻：${short} `);
    try {
      const assets = await generateQuestionAssets(id, item.question);
      const okLangs = Object.keys(assets.audio).length;
      if (assets.warnings.length) {
        assetsFailed += 1;
        console.log(`\n⚠ 部分失敗（音頻 ${okLangs}/5）：`);
        for (const w of assets.warnings) console.log(`    ${w.split("\n")[0]}`);
      } else {
        assetsOk += 1;
        console.log(`✓（音頻 ${okLangs}/5）`);
      }
    } catch (e) {
      assetsFailed += 1;
      console.log(`\n✗ 生成失敗：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\n完成：新增 ${inserted} 題｜資產已齊跳過 ${skipped} 題｜音頻生成成功 ${assetsOk}｜失敗 ${assetsFailed}`);
  if (assetsFailed > 0) {
    console.log("有失敗項，可稍後再跑一次（已齊全嘅會自動跳過）");
    process.exit(2);
  }
}

main().catch((e) => {
  console.error("✗ 執行失敗:", e);
  process.exit(1);
});
