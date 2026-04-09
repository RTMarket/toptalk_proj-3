-- 邀请码库存 + 兑换记录（后台统计用）

create table if not exists public.invite_codes (
  code text primary key,
  plan_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists invite_codes_plan_id_idx on public.invite_codes(plan_id);

create table if not exists public.invite_redemptions (
  id bigserial primary key,
  code text not null,
  plan_id text not null,
  user_id uuid,
  user_email text,
  user_nickname text,
  redeemed_at timestamptz not null default now()
);
create index if not exists invite_redemptions_redeemed_at_idx on public.invite_redemptions(redeemed_at desc);
create index if not exists invite_redemptions_user_email_idx on public.invite_redemptions(user_email);
create index if not exists invite_redemptions_plan_id_idx on public.invite_redemptions(plan_id);

-- 安全：仅由 service_role（Edge Functions）读写
alter table public.invite_codes enable row level security;
alter table public.invite_redemptions enable row level security;

