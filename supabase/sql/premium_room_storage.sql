-- TopTalk 高级聊天室：Storage 桶 + RLS 策略（在 Supabase → SQL Editor 中执行）
-- 解决：文件上传失败 new row violates row-level security policy（storage.objects INSERT 被拒）
--
-- 说明：
-- 1) 桶需存在且建议设为 public，便于 getPublicUrl 给房间内所有人访问。
-- 2) 若你在 Vercel 配置了 SUPABASE_SERVICE_ROLE_KEY 并使用 /api/premium-upload-sign 签名上传，
--    客户端可绕过 anon 的 INSERT 策略；但本地 vite 直连仍建议保留下列策略。

-- 创建桶（已存在则跳过）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('premium-room-files', 'premium-room-files', true, 10485760, NULL)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = COALESCE(EXCLUDED.file_size_limit, storage.buckets.file_size_limit);

DROP POLICY IF EXISTS "premium_room_files_insert_anon" ON storage.objects;
DROP POLICY IF EXISTS "premium_room_files_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "premium_room_files_select_public" ON storage.objects;
DROP POLICY IF EXISTS "premium_room_files_update_anon" ON storage.objects;
DROP POLICY IF EXISTS "premium_room_files_delete_anon" ON storage.objects;

-- 匿名/登录用户均可向该桶上传（创建者与加入者都使用前端 anon key）
CREATE POLICY "premium_room_files_insert_anon"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'premium-room-files');

CREATE POLICY "premium_room_files_insert_authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'premium-room-files');

-- 公开读（与 public 桶 + getPublicUrl 一致）
CREATE POLICY "premium_room_files_select_public"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'premium-room-files');
