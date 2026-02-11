/**
 * Redis-клиент и кеш для данных приложения (1С и др.).
 * Если REDIS_URL не задан — кеш отключён (get возвращает null, set ничего не делает).
 */

import Redis from "ioredis"

let redis: Redis | null = null

function getRedis(): Redis | null {
  const url = process.env.REDIS_URL
  if (!url?.trim()) return null
  if (redis) return redis
  try {
    redis = new Redis(url, { maxRetriesPerRequest: 2 })
    redis.on("error", (err) => {
      console.warn("[redis] error:", err.message)
    })
    redis.on("connect", () => {
      console.log("[redis] connected")
    })
    return redis
  } catch {
    return null
  }
}

/** Ключ кеша: префикс + userId (данные 1С зависят от пользователя) + опционально хэш параметров */
export function buildCacheKey(
  prefix: string,
  userId: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  const parts = [prefix, userId]
  if (params && Object.keys(params).length > 0) {
    const sorted = Object.keys(params)
      .sort()
      .map((k) => `${k}=${String(params[k] ?? "")}`)
      .join("&")
    parts.push(sorted)
  }
  return parts.join(":")
}

const DEFAULT_TTL_SEC = 300 // 5 минут

const LOG_PREFIX = "[redis]"

/** Прочитать из кеша (JSON). Возвращает null, если нет или Redis недоступен. */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const client = getRedis()
  if (!client) return null
  try {
    const raw = await client.get(key)
    if (raw == null) return null
    console.log(`${LOG_PREFIX} hit ${key}`)
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Записать в кеш (JSON). TTL в секундах. */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = DEFAULT_TTL_SEC
): Promise<void> {
  const client = getRedis()
  if (!client) return
  try {
    const serialized = JSON.stringify(value)
    await client.setex(key, ttlSeconds, serialized)
    console.log(`${LOG_PREFIX} set ${key} ttl=${ttlSeconds}s`)
  } catch {
    // игнорируем ошибки записи
  }
}

