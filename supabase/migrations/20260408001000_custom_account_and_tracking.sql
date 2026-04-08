-- 自建账户系统 + 统计（不存聊天内容）
-- 说明：
-- - 用户密码仅存 bcrypt 哈希
-- - 会话 token 仅存 hash（避免 DB 泄露直接可用）
-- - 事件仅记录创建/进入/离开房间等，不记录消息内容

create extension if not exists pgcrypto;

-- ── 用户表 ────────────────────────────────────────────────
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  nickname text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  login_count int not null default 0
);

create index if not exists idx_app_users_email on public.app_users (email);

-- ── 会话表 ────────────────────────────────────────────────
create table if not exists public.app_user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  session_token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip text,
  user_agent text
);

create index if not exists idx_app_user_sessions_user_id on public.app_user_sessions (user_id);
create index if not exists idx_app_user_sessions_token_hash on public.app_user_sessions (session_token_hash);
create index if not exists idx_app_user_sessions_expires on public.app_user_sessions (expires_at);

-- ── 房间事件（创建/进入/离开/解散） ─────────────────────────
create table if not exists public.room_events (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  room_type text not null, -- instant | premium
  user_id uuid not null references public.app_users(id) on delete cascade,
  event text not null, -- create | enter | leave | dissolve
  created_at timestamptz not null default now()
);

create index if not exists idx_room_events_room on public.room_events (room_id, created_at desc);
create index if not exists idx_room_events_user on public.room_events (user_id, created_at desc);

-- ── 房间参与聚合（用于“进入过哪些房间/使用时长”） ─────────────
create table if not exists public.room_participants (
  room_id text not null,
  room_type text not null,
  user_id uuid not null references public.app_users(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  enter_count int not null default 0,
  primary key (room_id, user_id)
);

create index if not exists idx_room_participants_user on public.room_participants (user_id, last_seen_at desc);

-- ── 共现关系（简单口径：同房间出现过即算） ────────────────────
create table if not exists public.user_co_presence (
  user_id uuid not null references public.app_users(id) on delete cascade,
  other_user_id uuid not null references public.app_users(id) on delete cascade,
  first_met_at timestamptz not null default now(),
  last_met_at timestamptz not null default now(),
  room_count int not null default 0,
  primary key (user_id, other_user_id)
);

create index if not exists idx_user_co_presence_user on public.user_co_presence (user_id, last_met_at desc);

-- ── 用户每日活跃时长（可选：先预留） ─────────────────────────
create table if not exists public.user_activity_daily (
  user_id uuid not null references public.app_users(id) on delete cascade,
  day date not null,
  active_seconds int not null default 0,
  primary key (user_id, day)
);

create index if not exists idx_user_activity_daily_day on public.user_activity_daily (day);

-- RLS：开启但暂不写 policy（由 Edge Function service role 写入/读取）
alter table public.app_users enable row level security;
alter table public.app_user_sessions enable row level security;
alter table public.room_events enable row level security;
alter table public.room_participants enable row level security;
alter table public.user_co_presence enable row level security;
alter table public.user_activity_daily enable row level security;

