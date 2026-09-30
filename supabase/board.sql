-- ============================================================
-- 資訊交流區（留言板）— 在 Supabase Dashboard → SQL Editor 執行
-- 僅審核通過的用戶可發帖（權限在 API 層校驗，service role 直連）
-- ============================================================

create table if not exists board_posts (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  title       text not null,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists board_posts_created_idx on board_posts(created_at desc);
