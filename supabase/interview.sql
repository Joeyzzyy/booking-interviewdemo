-- ============================================================
-- 視頻面試功能 — Supabase 建表 SQL（冪等，可重複執行）
-- 在 Supabase Dashboard → SQL Editor 執行
-- ============================================================

-- ─── 1. 面試題庫（管理員配置） ───
create table if not exists interview_questions (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,                -- 問題（文字出題）
  focus      text,                         -- 考察要點（可選，AI 判斷用）
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── 2. 面試（一條 token 連結 = 一場面試） ───
create table if not exists interviews (
  id               uuid primary key default gen_random_uuid(),
  token            text unique not null,   -- 工人端連結 /interview/<token>
  worker_name      text not null,
  resume_text      text,                   -- 簡歷文字（上傳 PDF/TXT 自動提取，可手改）
  resume_file_path text,                   -- 簡歷原件在 storage 的路徑
  status           text not null default 'pending'
                   check (status in ('pending','in_progress','completed')),
  report           jsonb,                  -- AI 整體報告
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);
create index if not exists idx_interviews_created on interviews(created_at desc);

-- ─── 3. 作答記錄（每題可多次，最多 3 次） ───
create table if not exists interview_answers (
  id            uuid primary key default gen_random_uuid(),
  interview_id  uuid not null references interviews(id) on delete cascade,
  question_id   uuid references interview_questions(id) on delete set null,
  question_text text not null,             -- 問題快照（防止題庫後改）
  attempt       integer not null,          -- 第幾次作答（1-3）
  video_path    text,                      -- 視頻在 storage 的路徑
  transcript    text,                      -- 語音轉文字結果
  passed        boolean,                   -- AI 判斷是否通過
  feedback      text,                      -- AI 反饋（不通過原因/提示）
  created_at    timestamptz not null default now()
);
create index if not exists idx_interview_answers_interview on interview_answers(interview_id);

-- ─── 4. 視頻/簡歷存儲 bucket（私有） ───
insert into storage.buckets (id, name, public)
values ('interview-videos', 'interview-videos', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'service role full access on interview-videos'
  ) then
    create policy "service role full access on interview-videos"
    on storage.objects for all
    to service_role
    using (bucket_id = 'interview-videos')
    with check (bucket_id = 'interview-videos');
  end if;
end $$;
