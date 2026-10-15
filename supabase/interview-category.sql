-- ============================================================
-- AI 視頻面試：題目分類（公共題庫按表單章節分組展示）
-- 冪等，可重複執行。請在 supabase/interview-ownership.sql 之後執行。
-- ============================================================
-- category 為分類 key（如 administrative / personal / skills …），
-- 對應《DOMESTIC HELPER CV DATA COLLECTION INTERVIEW FORM》9 個章節；
-- NULL = 用戶自定義問題（歸入「自定義問題」組）。

alter table interview_questions
  add column if not exists category text;

create index if not exists idx_interview_questions_category
  on interview_questions(category);
