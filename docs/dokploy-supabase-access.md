# Где взять доступы и куда вставить

**Pulse читает только `.env` в корне проекта.** Всё, что нужно, — туда.

---

## Для входа (логин/регистрация) нужны 2 вещи

Пароль от базы и DATABASE_URL **для входа не нужны.** Только URL и anon key.

---

### 1. URL (NEXT_PUBLIC_SUPABASE_URL)

**Что взять:** адрес, по которому открывается Supabase в браузере (Studio).

**Где взять:**
- В **Dokploy** у приложения Supabase — настройки маршрутизации / **Traefik** → домен, который привязан к этому приложению (например `supabase.ваш-домен.ru` или `supabase.traefik.me`).
- Либо тот URL, по которому вы уже заходите в **Supabase Studio** в браузере.

**Куда вставить:** в `.env` в корне Pulse:
```env
NEXT_PUBLIC_SUPABASE_URL="https://ваш-traefik-домен"
```
Без слэша в конце. Если у вас http — пишите `http://...`.

---

### 2. Anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY)

**Что взять:** длинный ключ (JWT), «anon public» key.

**Где взять:**
- **Вариант А:** открыть **Supabase Studio** по тому URL из п.1 → слева **Settings** (шестерёнка) → **API** → в блоке «Project API keys» скопировать **anon** (public).
- **Вариант Б:** в **Dokploy** → приложение Supabase → сервис **api** (или **rest** / **kong**) → вкладка **Environment** / **Variables** → переменная вроде `ANON_KEY` или `SUPABASE_ANON_KEY` — скопировать значение.

**Куда вставить:** в `.env`:
```env
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
```

---

### Итого для входа в приложение

В `.env` достаточно:
```env
NEXT_PUBLIC_SUPABASE_URL="https://ваш-traefik-домен"
NEXT_PUBLIC_SUPABASE_ANON_KEY="скопированный_anon_key"
```
Сохранили → `npm run dev` — логин/регистрация работают.

---

## Пароль и DATABASE_URL — не для входа

Они нужны **только** если будешь запускать Prisma (`npm run db:push` и т.п.) с твоего ПК через SSH-туннель.

- **Пароль Postgres:** в Dokploy → приложение Supabase → сервис **db** → **Environment** → переменная **POSTGRES_PASSWORD**.
- **Куда:** в `.env` строка `DATABASE_URL="postgresql://postgres:ЭТОТ_ПАРОЛЬ@127.0.0.1:5433/postgres"` (и туннель должен быть поднят — см. `supabase-vps-postgres.md`).

Для одного только входа в Pulse это не трогаем.

---

## «SNIPPETS_MANAGEMENT_FOLDER env var is not set» в Studio

Это предупреждение появляется **в интерфейсе Supabase Studio** (self-hosted), когда открываешь SQL Editor или раздел со сниппетами.

**Что это:** функция «сниппеты» (сохранение SQL-запросов в Studio) в self-hosted Supabase **не поддерживается** — она только в облаке. Переменная `SNIPPETS_MANAGEMENT_FOLDER` как раз для этой функции.

**Что делать:** можно **игнорировать**. На Auth, Storage, БД и на Pulse это не влияет. Если хочешь убрать предупреждение: в Dokploy открой приложение Supabase → сервис **studio** (или тот, где крутится веб-интерфейс Studio) → **Environment** → добавь переменную `SNIPPETS_MANAGEMENT_FOLDER` с любым значением (например `/tmp/snippets`). Само сохранение сниппетов при этом всё равно не заработает — это просто скроет сообщение.
