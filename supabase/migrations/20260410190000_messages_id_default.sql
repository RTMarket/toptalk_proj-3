-- messages.id 若 NOT NULL 且无 DEFAULT，INSERT 省略 id 会报：
-- null value in column "id" of relation "messages" violates not-null constraint
-- 与客户端显式传入 id（见 premiumRoomDbMessages / FreeChatRoom）互补

alter table if exists public.messages
  alter column id set default gen_random_uuid();
