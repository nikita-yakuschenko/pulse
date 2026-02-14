/**
 * Redis-клиент и кеш для данных приложения (1С и др.).
 * Если REDIS_URL не задан — используется in-memory кеш (TTL по ключу), чтобы не ждать 1С при каждом запросе.
 * При ошибке подключения (ENOTFOUND, ECONNREFUSED) клиент отключается и повтор не выполняется 60 с.
 */

import Redis from "ioredis"

let redis: Redis | null = null
/** После ошибки подключения не создаём новый клиент до этой метки времени (мс). */
let redisBackoffUntil = 0

/** In-memory кеш при отсутствии Redis (локальная разработка): ключ → { value, expires (ms) }. */
const memoryCache = new Map<string, { value: string; expires: number }>()
const MEMORY_CACHE_MAX_ENTRIES = 200

function getRedis(): Redis | null {
  const url = process.env.REDIS_URL
  if (!url?.trim()) return null
  if (Date.now() < redisBackoffUntil) return null
  if (redis) return redis
  try {
    const client = new Redis(url, { maxRetriesPerRequest: 2 })
    client.on("error", (err: NodeJS.ErrnoException) => {
      const msg = err?.message ?? ""
      const isConnectionError =
        err?.code === "ENOTFOUND" ||
        err?.code === "ECONNREFUSED" ||
        err?.code === "ETIMEDOUT" ||
        msg.includes("ENOTFOUND") ||
        msg.includes("ECONNREFUSED")
      if (isConnectionError) {
        redisBackoffUntil = Date.now() + 60_000
        console.warn("[redis] недоступен:", msg, "— кеш отключён на 1 мин. Проверьте REDIS_URL и сеть (в Docker имя хоста = имя сервиса Redis).")
        client.quit().catch(() => {})
        redis = null
      } else {
        console.warn("[redis] error:", msg)
      }
    })
    client.on("connect", () => {
      console.log("[redis] connected")
    })
    redis = client
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

/** Прочитать из кеша (JSON). При отсутствии Redis — in-memory кеш. */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const client = getRedis()
  if (client) {
    try {
      const raw = await client.get(key)
      if (raw == null) return null
      console.log(`${LOG_PREFIX} hit ${key}`)
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }
  const entry = memoryCache.get(key)
  if (!entry || entry.expires < Date.now()) {
    if (entry) memoryCache.delete(key)
    return null
  }
  try {
    return JSON.parse(entry.value) as T
  } catch {
    memoryCache.delete(key)
    return null
  }
}

/** Записать в кеш (JSON). TTL в секундах. При отсутствии Redis — in-memory. */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = DEFAULT_TTL_SEC
): Promise<void> {
  const serialized = JSON.stringify(value)
  const client = getRedis()
  if (client) {
    try {
      await client.setex(key, ttlSeconds, serialized)
      console.log(`${LOG_PREFIX} set ${key} ttl=${ttlSeconds}s`)
    } catch {
      // игнорируем ошибки записи
    }
    return
  }
  if (memoryCache.size >= MEMORY_CACHE_MAX_ENTRIES) {
    const now = Date.now()
    for (const [k, v] of memoryCache) {
      if (v.expires < now) memoryCache.delete(k)
    }
    if (memoryCache.size >= MEMORY_CACHE_MAX_ENTRIES) {
      const first = memoryCache.keys().next().value
      if (first) memoryCache.delete(first)
    }
  }
  memoryCache.set(key, { value: serialized, expires: Date.now() + ttlSeconds * 1000 })
}

