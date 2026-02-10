# Безопасность интеграции 1С

## Текущая реализация

Credentials (логин и пароль) хранятся в `user_metadata` Supabase Auth.

**Защита (из коробки Supabase):**
- ✅ **Encryption at rest** — Supabase шифрует данные в `auth.users` автоматически
- ✅ **RLS (Row Level Security)** — доступ только у владельца аккаунта
- ✅ **HTTPS** для всех запросов к API
- ✅ **Управление ключами** — Supabase управляет ключами шифрования
- ✅ **Basic Auth с UTF-8** — поддержка кириллицы в логинах

**Проверка подключения:**
```
GET https://api.module.team/module.team/hs/health/check
Authorization: Basic {base64(username:password)}
```

При успешном ответе (200 OK) credentials сохраняются в `user_metadata.integrations["1c"]`.

---

## Почему `user_metadata` безопасно

✅ **Supabase Auth шифрует данные:**
- Таблица `auth.users` использует encryption at rest
- Ключи шифрования управляются Supabase
- Даже при доступе к backup'ам данные зашифрованы

✅ **Подходит для продакшена:**
- Используется в production-приложениях
- Соответствует industry standards
- RLS изолирует данные между пользователями

✅ **Не требует дополнительной реализации шифрования**

---

## Альтернативные подходы (опционально)

Текущая реализация через `user_metadata` **достаточна для продакшена**, но для специфичных требований можно использовать:

### Вариант 1: Отдельная таблица с application-level encryption

Создать отдельную таблицу для credentials:

```sql
CREATE TABLE user_credentials (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  service VARCHAR NOT NULL, -- '1c', 'bitrix24', 'telegram'
  encrypted_data TEXT NOT NULL, -- зашифрованный JSON
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own credentials"
ON user_credentials
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

**Шифрование на сервере:**
```typescript
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY! // 32 байта
const ALGORITHM = 'aes-256-gcm'

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, dataHex] = encrypted.split(':')
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    Buffer.from(ivHex, 'hex')
  )
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  return decipher.update(Buffer.from(dataHex, 'hex'), undefined, 'utf8') + decipher.final('utf8')
}
```

### Вариант 2: HashiCorp Vault

Использовать внешний Vault-сервис:
```typescript
import Vault from 'node-vault'

const vault = Vault({
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN,
})

// Сохранить
await vault.write(`secret/data/users/${userId}/1c`, {
  data: { username, password }
})

// Получить
const { data } = await vault.read(`secret/data/users/${userId}/1c`)
const credentials = data.data
```

### Вариант 3: AWS Secrets Manager / GCP Secret Manager

Для облачных деплоев:
```typescript
import { SecretsManager } from '@aws-sdk/client-secrets-manager'

const client = new SecretsManager({ region: 'us-east-1' })

await client.createSecret({
  Name: `pulse/users/${userId}/1c`,
  SecretString: JSON.stringify({ username, password }),
})
```

---

## Когда нужны альтернативные подходы

**Триггеры для дополнительного шифрования:**
1. **Специфичные compliance-требования** (банки, медицина)
2. **Zero-knowledge architecture** — даже Supabase не должен видеть credentials
3. **Ротация ключей шифрования** под вашим контролем
4. **Аудит требует application-level encryption**

**В большинстве случаев** — `user_metadata` Supabase Auth **достаточно**.

---

## Рекомендации

**Текущая реализация (готова для продакшена):**
- ✅ `user_metadata` с encryption at rest от Supabase
- ✅ RLS изолирует данные между пользователями
- ✅ HTTPS для всех запросов
- ✅ Ограничить права пользователей 1С (read-only где возможно)

**Дополнительные меры безопасности:**
- Регулярный аудит доступа к Supabase
- Включить audit logging в Supabase
- Ротация паролей 1С (раз в 90 дней)
- Мониторинг неудачных попыток авторизации
- Rate limiting на API endpoints

**Вывод:** Текущая реализация через `user_metadata` **безопасна и готова для production**.
