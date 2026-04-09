-- 高级/即时聊天室：后进用户需能读取同一 room_id 的历史消息（否则仅实时广播可见，历史永远为空）
-- 前提：已存在 public.messages，且 room_id 形如 free_<房间> / premium_<房间>（与客户端一致）
--
-- 在 Supabase：若 messages 已开启 RLS 但缺少 SELECT policy，默认会导致“只能插入、读不到别人发的行”。

alter table if exists public.messages enable row level security;

drop policy if exists "messages_select_room_history" on public.messages;

create policy "messages_select_room_history"
on public.messages
for select
to anon, authenticated
using (room_id like 'free_%' or room_id like 'premium_%');
