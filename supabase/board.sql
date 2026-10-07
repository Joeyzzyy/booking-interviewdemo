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

-- 帖子圖片公共桶（富文本內嵌圖片需要長期可訪問的 URL，私有桶 signed URL 會過期）
insert into storage.buckets (id, name, public)
values ('board-images', 'board-images', true)
on conflict (id) do nothing;

-- 帖子讚好（一個用戶對一個帖子最多一個）
create table if not exists board_post_likes (
  post_id uuid not null references board_posts(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, customer_id)
);

-- 帖子留言（純文本，≤500 字；刪除權限在 API 層校驗：留言者 / 帖主 / 管理員）
create table if not exists board_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references board_posts(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists board_comments_post_idx on board_comments(post_id, created_at);
