# Модуль.Пульс (pulse)

Система управления закупками и KPI для отдела закупок, снабжения и логистики. Интеграции: 1С, Битрикс24, Telegram.

## Продукт

Производство панельно-каркасных и модульных домов + монтаж на объекте.

## Первый выделенный процесс

Цепочка: **plan → mrp → sorders → payments**

| Звено | Описание |
|-------|----------|
| plan | План производства и монтажей |
| mrp | MRP-отчёт: потребность + остатки → объём закупки |
| sorders | Заказы поставщикам |
| payments | Платежи (в 1С — ЗРДС) |

## Стек

- **Frontend:** Next.js 15, React 19, TypeScript
- **UI:** Tailwind CSS, shadcn/ui, Inter, светлая/тёмная тема
- **Auth:** Better Auth
- **БД:** Supabase (Postgres) + Prisma ORM
- **Интеграции:** REST (1С, Битрикс24), Telegram Bot API
- **Контейнеризация:** Docker

## Быстрый старт

```bash
# Установка
npm install

# Настройка
cp .env.example .env
# Заполните DATABASE_URL и BETTER_AUTH_SECRET

# Генерация Prisma Client
npm run db:generate

# Миграция БД (при наличии подключения)
npm run db:push

# Разработка
npm run dev
```

Приложение доступно по адресу http://localhost:3000

## Docker

```bash
# Сборка и запуск
docker compose up -d

# При первом запуске выполните миграцию
docker compose exec app npx prisma db push
```

## Структура проекта

```
src/
├── app/
│   ├── (auth)/          # sign-in, sign-up
│   ├── (dashboard)/     # plan, mrp, sorders, payments, settings
│   └── api/auth/        # Better Auth handlers
├── components/
│   ├── ui/              # shadcn
│   ├── providers/
│   └── theme-toggle.tsx
├── lib/
│   ├── auth.ts          # Better Auth config
│   ├── auth-client.ts
│   ├── db.ts            # Prisma client
│   └── utils.ts
├── modules/             # plan, mrp, sorders, payments
├── integrations/        # 1c, bitrix24, telegram
└── types/
```

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Режим разработки |
| `npm run build` | Сборка |
| `npm run start` | Запуск production |
| `npm run db:generate` | Генерация Prisma Client |
| `npm run db:push` | Синхронизация схемы с БД |
| `npm run db:seed` | Сид данных |

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | URL PostgreSQL (Supabase) |
| `BETTER_AUTH_SECRET` | Секрет для подписи (min 32 символа) |
| `BETTER_AUTH_URL` | Базовый URL приложения |

## Архитектура

См. [план архитектуры](.cursor/plans/) для детального описания модулей, цепочек и интеграций.
