-- ============================================================
-- AI 視頻面試：開放給所有登入用戶使用，資料按用戶隔離
-- 冪等，可重複執行。請在 supabase/interview.sql 之後執行。
-- ============================================================
-- 說明：
--   interview_questions.customer_id 為 NULL 時 = 後台「共用示範題庫」；
--   用戶在預約工作台建立的題目/面試都會帶上自己的 customer_id，
--   彼此不可見、互不影響，方便日後整體拆分成獨立服務。

-- ─── 1. 題庫歸屬 ───
alter table interview_questions
  add column if not exists customer_id uuid references customers(id) on delete cascade;
create index if not exists idx_interview_questions_customer
  on interview_questions(customer_id, active, sort_order);

-- ─── 2. 面試歸屬 ───
alter table interviews
  add column if not exists customer_id uuid references customers(id) on delete cascade;
create index if not exists idx_interviews_customer
  on interviews(customer_id, created_at desc);
