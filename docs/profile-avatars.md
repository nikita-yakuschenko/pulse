# Загрузка аватарки в профиле

В разделе **Настройки → Профиль** пользователь может загрузить фото. Файл сохраняется в Supabase Storage.

**Если в `.env` задан `SUPABASE_SERVICE_ROLE_KEY`**, бакет `avatars` создаётся автоматически при первой загрузке фото (публичный). Если ключа нет или нужна ручная настройка — см. ниже.

## Создание bucket вручную

1. В Supabase: **Storage** → **New bucket**
2. Имя: `avatars`
3. **Public bucket**: включить (чтобы URL фото был доступен без подписи)
4. В политиках (Policies) bucket `avatars`:
   - **Upload**: аутентифицированные пользователи могут загружать только в свою папку:  
     `(bucket_id = 'avatars') AND (auth.uid())::text = (storage.foldername(name))[1]`
   - **Select**: публичное чтение (для Public bucket обычно уже есть)

### Политики доступа (RLS) через SQL

Если загрузка или просмотр фото не работают (ошибка доступа), нужно добавить политики. **Куда вставить:** открой свой проект в [Supabase Dashboard](https://supabase.com/dashboard) → слева **SQL Editor** → **New query**. Вставь код ниже в окно запроса и нажми **Run**.

```sql
-- Разрешить аутентифицированным загружать только в свою папку (user_id/avatar.jpg)
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Публичное чтение (чтобы аватарки открывались по ссылке)
CREATE POLICY "Public read avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

После создания bucket и (при необходимости) выполнения SQL загрузка фото в профиле будет работать.
