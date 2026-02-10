# Примеры работы с 1С API

## Настройка

Пользователи настраивают подключение к 1С в разделе **Настройки → Интеграции → 1С**:
- Выбирают среду (тестовая/боевая)
- Вводят логин (может быть кириллицей)
- Вводят пароль
- Включают интеграцию

## Использование в коде

### Создание клиента

```typescript
import { createOneCClient } from "@/lib/1c-client"

const client = createOneCClient({
  environment: "test", // или "production"
  username: "Иван",
  password: "password123",
})
```

### GET-запрос

```typescript
// Получить данные
const data = await client.get("specifications")
```

### POST-запрос

```typescript
// Отправить данные
const result = await client.post("create-order", {
  supplierId: "123",
  items: [{ sku: "ABC", quantity: 10 }],
})
```

### Проверка подключения

```typescript
const isConnected = await client.testConnection()
if (!isConnected) {
  console.error("Не удалось подключиться к 1С")
}
```

## Получение credentials из настроек пользователя

```typescript
import { createClient } from "@/lib/supabase/server"
import { createOneCClient } from "@/lib/1c-client"

export async function getOneCClient() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Не авторизован")

  const integrations = user.user_metadata?.integrations as Record<string, any> | undefined
  const oneCSettings = integrations?.["1c"]
  
  if (!oneCSettings?.enabled) {
    throw new Error("Интеграция 1С не включена")
  }

  return createOneCClient({
    environment: oneCSettings.environment,
    username: oneCSettings.username,
    password: oneCSettings.password,
  })
}
```

## Пример API route

```typescript
// app/api/1c/specifications/route.ts
import { NextResponse } from "next/server"
import { getOneCClient } from "@/integrations/1c"

export async function GET() {
  try {
    const client = await getOneCClient()
    const data = await client.get("specifications")
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка" },
      { status: 500 }
    )
  }
}
```

## Особенности

1. **Кириллица в логине**: автоматически обрабатывается через UTF-8 encoding
2. **Таймауты**: по умолчанию 10 секунд для проверки подключения
3. **Ошибки**: все методы выбрасывают `Error` при неудаче, нужен try-catch
4. **Среды**: тестовая для разработки, боевая для продакшена
