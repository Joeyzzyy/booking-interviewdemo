-- 論壇管理 + 置頂功能：客戶管理員標記 + 帖子置頂欄位
-- 在 Supabase SQL Editor 手動執行（冪等，可重複運行）

-- 客戶是否管理員（管理員可置頂/刪除任何帖子；由後台「用戶管理」設置）
alter table customers add column if not exists is_admin boolean not null default false;

-- 帖子置頂標記
alter table board_posts add column if not exists pinned boolean not null default false;

-- 置頂帖子排序索引（列表按 pinned desc, created_at desc）
create index if not exists board_posts_pin_idx on board_posts(pinned desc, created_at desc);
