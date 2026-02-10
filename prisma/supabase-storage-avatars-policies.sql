-- RLS-политики для bucket avatars (Storage)
-- Выполнить один раз в Supabase: SQL Editor → New query → вставить и Run
-- Ошибка "new row violates row-level security policy" при загрузке аватара — из-за отсутствия этих политик

-- Удаляем старые политики, если перезапускаем скрипт (идемпотентность)
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;

-- INSERT: аутентифицированные загружают только в свою папку (user_id/avatar.jpg)
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: перезапись своего аватара (upsert в API)
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: публичное чтение по ссылке
CREATE POLICY "Public read avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
