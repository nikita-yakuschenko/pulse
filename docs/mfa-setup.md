# Настройка 2FA (двухфакторная аутентификация)

Поддерживаются три способа подтверждения при входе:

1. **Google Authenticator** (TOTP) — работает без дополнительной настройки
2. **Код на почту** — требует Resend
3. **Код в Telegram** — через Telegram Verification Gateway

## Настройка

### 1. Таблица mfa_code

Выполнить миграцию:

```bash
npx prisma db push
```

При использовании RLS добавить политику для таблицы `mfa_code` (см. `prisma/supabase-rls-policies.sql`).

### 2. Код на почту (Resend)

1. Зарегистрироваться на [resend.com](https://resend.com)
2. Получить API-ключ
3. Добавить в `.env`:

```
RESEND_API_KEY="re_xxx"
RESEND_FROM_EMAIL="noreply@yourdomain.com"
```

`RESEND_FROM_EMAIL` — адрес отправителя (должен быть верифицирован в Resend).

### 3. Код в Telegram (Verification Gateway)

1. Войти на [gateway.telegram.org](https://gateway.telegram.org)
2. Пополнить баланс (для тестов бесплатно — отправка на свой номер)
3. Скопировать API-токен
4. Добавить в `.env`:

```
TELEGRAM_GATEWAY_TOKEN="xxx"
```

Пользователь указывает номер телефона в формате E.164 (например, +79001234567). Код придёт в приложение Telegram через бота @VerificationCodes.

### 4. Подпись cookie (опционально)

Для production рекомендуется задать секрет подписи cookie:

```
MFA_COOKIE_SECRET="random-secure-string"
```

Иначе используется `NEXTAUTH_SECRET` или значение по умолчанию.

### 5. Сброс 2FA при потере доступа

Если пользователь удалил запись из Google Authenticator или потерял доступ к кодам, он может сбросить 2FA, введя **email и пароль** на экране ввода кода (ссылка «Потеряли доступ к приложению? Сбросить 2FA»).

Для работы сброса нужен **Service Role Key** Supabase (только на сервере, не отдавать на клиент):

```
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

Ключ берётся в настройках проекта Supabase (API → service_role). После сброса все MFA-факторы (TOTP) удаляются, `user_metadata.mfa_method` очищается; пользователь сможет войти без 2FA и при необходимости включить её заново.
