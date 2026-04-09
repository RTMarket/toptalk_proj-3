-- 与 migrations/20260410160000_messages_select_policy_room_history.sql 相同
-- 可在 Supabase SQL Editor 手动执行（若你未走 migration 流水线）

alter table if exists public.messages enable row level security;

drop policy if exists "messages_select_room_history" on public.messages;

create policy "messages_select_room_history"
on public.messages
for select
to anon, authenticated
using (room_id like 'free_%' or room_id like 'premium_%');
