-- ============================================================
-- OnePlus 服務預約系統 — Supabase 完整建表 SQL（冪等，可重複執行）
-- 在 Supabase Dashboard → SQL Editor 執行
-- ============================================================

-- ─── 1. 客戶賬號（郵箱驗證碼註冊/登入一體） ───
create table if not exists customers (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  created_at timestamptz not null default now()
);

-- ─── 2. 登入驗證碼（sha256 存儲，10 分鐘有效，用後即廢） ───
create table if not exists email_codes (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  code       text not null,
  expires_at timestamptz not null,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_email_codes_email on email_codes(email, created_at desc);

-- ─── 3. 登入會話（httpOnly cookie 攜帶 token，30 天有效） ───
create table if not exists customer_sessions (
  token       text primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_customer_sessions_expiry on customer_sessions(expires_at);

-- ─── 4. 訂單表 ───
create table if not exists bookings (
  id            uuid primary key default gen_random_uuid(),
  order_no      text unique not null,           -- 人讀單號，如 BK20260918-X7K2
  service_key   text not null,                  -- medical / pickup / combo / full-pack
  service_label text not null,
  price_hkd     integer,                        -- 下單時快照價
  employer_name text not null,
  phone         text not null,
  whatsapp      text,
  email         text not null,
  worker_name   text not null,
  customer_id   uuid references customers(id),  -- 綁定賬號
  details       jsonb not null default '{}',    -- 服務專屬欄位（航班、驗身日期、護照號碼等）
  remark        text,
  files         jsonb not null default '[]',    -- [{name, path, size}]
  status        text not null default 'pending'
                check (status in ('pending','confirmed','rejected','cancelled')),
  payment_status text not null default 'none'
                check (payment_status in ('none','pending','paid','refunded')),
  stripe_session_id text,
  admin_note    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_bookings_status on bookings(status);
create index if not exists idx_bookings_created on bookings(created_at desc);
create index if not exists idx_bookings_customer on bookings(customer_id);
-- 已有 bookings 表時補 customer_id 欄位：
alter table bookings add column if not exists customer_id uuid references customers(id);

-- ─── 5. 套票購買訂單（Stripe 付款記錄） ───
create table if not exists pass_orders (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references customers(id) on delete cascade,
  service_key       text not null,
  quantity          integer not null check (quantity in (1, 10)),
  amount_hkd        integer not null,
  stripe_session_id text,
  status            text not null default 'pending'
                    check (status in ('pending','paid','failed','refunded')),
  created_at        timestamptz not null default now(),
  paid_at           timestamptz
);
create index if not exists idx_pass_orders_customer on pass_orders(customer_id, created_at desc);
create unique index if not exists idx_pass_orders_session on pass_orders(stripe_session_id);

-- ─── 6. 套票餘額（每用戶 × 服務一行） ───
create table if not exists pass_credits (
  customer_id uuid not null references customers(id) on delete cascade,
  service_key text not null,
  total       integer not null default 0,
  used        integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (customer_id, service_key)
);

-- ─── 7. 原子核銷函數（餘額不足返回 false，防止並發超扣） ───
create or replace function consume_pass_credit(p_customer_id uuid, p_service_key text)
returns boolean language plpgsql security definer as $$
begin
  update pass_credits
     set used = used + 1, updated_at = now()
   where customer_id = p_customer_id
     and service_key = p_service_key
     and used < total;
  return found;
end $$;

-- ─── 8. 原子退回函數（拒絕/取消訂單時） ───
create or replace function refund_pass_credit(p_customer_id uuid, p_service_key text)
returns void language plpgsql security definer as $$
begin
  update pass_credits
     set used = greatest(used - 1, 0), updated_at = now()
   where customer_id = p_customer_id and service_key = p_service_key;
end $$;

-- ─── 9. 文件存儲 bucket（私有，存用戶上傳的工人資料） ───
insert into storage.buckets (id, name, public)
values ('booking-files', 'booking-files', false)
on conflict (id) do nothing;

-- policy 用 DO 塊包裝，已存在時自動跳過（整批同事務，單句報錯會全部回滾）
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'service role full access on booking-files'
  ) then
    create policy "service role full access on booking-files"
    on storage.objects for all
    to service_role
    using (bucket_id = 'booking-files')
    with check (bucket_id = 'booking-files');
  end if;
end $$;
