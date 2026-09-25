-- ============================================================
-- NEXUSLINK 賬號體系升級：電郵 + 手機短訊雙通道登入 / 綁定
-- 冪等，可重複執行。在 Supabase Dashboard → SQL Editor 執行。
-- ============================================================

-- ─── 1. customers：email 允許 NULL，新增 phone ───
alter table customers alter column email drop not null;
alter table customers add column if not exists phone text;
-- 手機號唯一（僅對非 NULL 生效）
create unique index if not exists idx_customers_phone on customers(phone) where phone is not null;

-- ─── 2. otp_codes：通用驗證碼（電郵 / 短訊共用，sha256 存儲） ───
create table if not exists otp_codes (
  id         uuid primary key default gen_random_uuid(),
  identifier text not null,                 -- 歸一化後的電郵或 E.164 手機號
  channel    text not null check (channel in ('email','phone')),
  code       text not null,                 -- sha256(code)
  expires_at timestamptz not null,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_otp_codes_lookup on otp_codes(identifier, channel, created_at desc);

-- ─── 3.（可選）把舊 email_codes 中仍有效的驗證碼遷移到 otp_codes ───
-- 用 DO 塊包裝：舊表不存在時自動跳過，不影響腳本其餘部分。
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'email_codes'
  ) then
    insert into otp_codes (identifier, channel, code, expires_at, used, created_at)
    select email, 'email', code, expires_at, used, created_at
    from email_codes
    where not exists (
      select 1 from otp_codes o where o.identifier = email_codes.email and o.code = email_codes.code
    );
  end if;
end $$;
