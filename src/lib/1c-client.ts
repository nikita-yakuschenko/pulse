/**
 * Клиент для работы с 1С API через api.module.team
 * Поддерживает кириллицу в логине через правильную UTF-8 кодировку
 */

export type OneCEnvironment = "test" | "production"

export const ONE_C_URLS = {
  test: "https://api.module.team/module.team/hs/",
  production: "https://api.module.team/main/hs/",
} as const

export interface OneCCredentials {
  environment: OneCEnvironment
  username: string
  password: string
}

/**
 * Создаёт Basic Auth заголовок с поддержкой кириллицы
 */
export function createBasicAuthHeader(username: string, password: string): string {
  const credentials = `${username}:${password}`
  const encoder = new TextEncoder()
  const data = encoder.encode(credentials)
  const base64 = Buffer.from(data).toString('base64')
  return `Basic ${base64}`
}

/** Таймаут запросов к 1С (сек). 1С может отвечать долго; 502 часто из-за таймаута прокси, а не падения 1С. */
const ONE_C_REQUEST_TIMEOUT_MS = 120_000

/**
 * Создаёт клиент для работы с 1С API
 */
export function createOneCClient(credentials: OneCCredentials) {
  const baseUrl = ONE_C_URLS[credentials.environment]
  const authHeader = createBasicAuthHeader(credentials.username, credentials.password)

  return {
    /**
     * Отправляет GET-запрос к 1С API
     */
    async get<T = unknown>(endpoint: string, options?: RequestInit): Promise<T> {
      const url = `${baseUrl}${endpoint}`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), ONE_C_REQUEST_TIMEOUT_MS)
      const signal = options?.signal ?? controller.signal

      try {
        const res = await fetch(url, {
          ...options,
          method: "GET",
          signal,
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader,
            ...options?.headers,
          },
        })
        clearTimeout(timeoutId)

        if (!res.ok) {
          if (res.status === 502) {
            throw new Error(
              "1С не успел ответить (502). Часто это таймаут прокси при долгом ответе 1С — повторите запрос или проверьте доступность 1С."
            )
          }
          throw new Error(`1С API error: ${res.status} ${res.statusText}`)
        }

        return res.json()
      } catch (err) {
        clearTimeout(timeoutId)
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("Таймаут запроса к 1С. Сервис отвечает слишком долго.")
        }
        throw err
      }
    },

    /**
     * Отправляет POST-запрос к 1С API
     */
    async post<T = unknown>(endpoint: string, body: unknown, options?: RequestInit): Promise<T> {
      const url = `${baseUrl}${endpoint}`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), ONE_C_REQUEST_TIMEOUT_MS)
      const signal = options?.signal ?? controller.signal

      try {
        const res = await fetch(url, {
          ...options,
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader,
            ...options?.headers,
          },
          body: JSON.stringify(body),
        })
        clearTimeout(timeoutId)

        if (!res.ok) {
          if (res.status === 502) {
            throw new Error(
              "1С не успел ответить (502). Часто это таймаут прокси при долгом ответе 1С — повторите запрос или проверьте доступность 1С."
            )
          }
          throw new Error(`1С API error: ${res.status} ${res.statusText}`)
        }

        return res.json()
      } catch (err) {
        clearTimeout(timeoutId)
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("Таймаут запроса к 1С. Сервис отвечает слишком долго.")
        }
        throw err
      }
    },

    /**
     * Проверяет подключение к 1С
     */
    async testConnection(): Promise<boolean> {
      try {
        const res = await fetch(baseUrl, {
          method: "GET",
          headers: {
            "Authorization": authHeader,
          },
          signal: AbortSignal.timeout(10000),
        })
        return res.ok
      } catch {
        return false
      }
    },
  }
}
