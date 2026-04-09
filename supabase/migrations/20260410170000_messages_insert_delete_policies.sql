-- 后进用户看不到历史，常见原因不是 SELECT，而是先发用户 INSERT 被 RLS 拦截（本地仍显示，但 DB 无行）
-- 以及阅后即焚到期删除需要 DELETE 权限
-- 前提：public.messages 已存在，且 room_id 为 free_/premium_ 前缀（与客户端一致）

alter table if exists public.messages enable row level security;

drop policy if exists "messages_insert_room" on public.messages;

create policy "messages_insert_room"
on public.messages
for insert
to anon, authenticated
with check (room_id like 'free_%' or room_id like 'premium_%');

drop policy if exists "messages_delete_room" on public.messages;

create policy "messages_delete_room"
on public.messages
for delete
to anon, authenticated
using (room_id like 'free_%' or room_id like 'premium_%');
