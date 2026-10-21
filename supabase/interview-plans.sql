-- AI 面試付費計劃：Basic（核實 CV）$199/月 / Advanced（自製 CV）$399/月
-- 訂閱狀態由 Stripe webhook 同步（customer.subscription.* 事件）

-- 訂閱表：一個用戶一個有效訂閱（Stripe subscription id 唯一）
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  plan text not null check (plan in ('basic', 'advanced')),
  status text not null default 'active' check (status in ('active', 'canceling', 'canceled')),
  stripe_subscription_id text unique,
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_customer_idx on subscriptions(customer_id);

-- 面試綁定計劃類型；Advanced 記錄勾選章節 + AI 生成的 CV
alter table interviews
  add column if not exists plan text check (plan in ('basic', 'advanced')),
  add column if not exists sections jsonb, -- advanced：選中的章節 key 數組（null/空 = 全部章節）
  add column if not exists cv jsonb;       -- advanced：AI 從作答生成的結構化 CV
