-- ============================================================
-- Advanced 面試 v2：實時逐題模式 + 作品照片
-- 執行位置：Supabase SQL Editor（正式庫）
-- 依賴：interview.sql / interview-answer-segments.sql / interview-plans.sql 已執行
-- ============================================================

-- 1) interviews：面試模式（continuous=整段錄製舊模式；per-question=實時逐題）+ 作品照片
alter table public.interviews
  add column if not exists mode text not null default 'continuous'
    check (mode in ('continuous', 'per-question')),
  add column if not exists photos jsonb not null default '[]'::jsonb;
-- photos: [{ "kind": "dish" | "work", "label": string, "path": string }]

-- 2) interview_answers.attempt：原註釋 1-3，前僱主迴圈第 4 位需要 1-4。
--    線上建表語句無 check 約束時本段為空操作保險：先加寬約束（若有）再復位。
do $$
begin
  -- 若存在 attempt <= 3 的 check 約束則刪除（命名不確定，按系統目錄匹配）
  if exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'interview_answers'
      and c.contype = 'c' and pg_get_constraintdef(c.oid) ilike '%attempt%'
  ) then
    execute (
      select 'alter table public.interview_answers drop constraint ' || quote_ident(c.conname)
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and t.relname = 'interview_answers'
        and c.contype = 'c' and pg_get_constraintdef(c.oid) ilike '%attempt%'
      limit 1
    );
  end if;
end $$;

comment on column public.interview_answers.attempt is '第幾次作答 / 前僱主迴圈中為第幾位僱主（1-4）';
comment on column public.interviews.mode is '面試模式：continuous=整段錄製；per-question=實時逐題（Advanced v2）';
comment on column public.interviews.photos is '作品照片 [{kind,label,path}]，存 interview-videos bucket photos/<interview_id>/';
