-- 注册邮箱验证码（仅由 Edge Function 通过 service role 写入）
create table if not exists public.email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  purpose text not null default 'register',
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists idx_email_verification_codes_email_purpose
  on public.email_verification_codes (email, purpose, expires_at);

alter table public.email_verification_codes enable row level security;

-- 订单审核备注（拒绝原因等；表若不存在则跳过）
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'payment_orders'
  ) then
    alter table public.payment_orders add column if not exists admin_remark text;
    -- 兼容老表结构：补齐前端/Edge Function 需要的昵称字段
    alter table public.payment_orders add column if not exists user_nickname text;
  end if;
end $$;
