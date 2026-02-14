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

/** Таймаут запросов к 1С (мс). */
const ONE_C_REQUEST_TIMEOUT_MS = 120_000

/** Задержка перед повтором при ошибке соединения (мс). */
const RETRY_DELAY_MS = 2_000

/** Проверка: ошибка установления соединения (таймаут/сеть), при которой имеет смысл повторить запрос. */
function isConnectOrNetworkError(err: unknown): boolean {
  const cause = err && typeof err === "object" && "cause" in err ? (err as { cause?: unknown }).cause : null
  const code = cause && typeof cause === "object" && "code" in cause ? (cause as { code?: string }).code : ""
  const msg = err instanceof Error ? err.message : String(err)
  return code === "UND_ERR_CONNECT_TIMEOUT" || /connect timeout|fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg)
}

/**
 * Создаёт клиент для работы с 1С API
 */
export function createOneCClient(credentials: OneCCredentials) {
  const baseUrl = ONE_C_URLS[credentials.environment]
  const authHeader = createBasicAuthHeader(credentials.username, credentials.password)

  return {
    /**
     * Отправляет GET-запрос к 1С API. При таймауте соединения или сетевой ошибке — один повтор через RETRY_DELAY_MS.
     */
    async get<T = unknown>(endpoint: string, options?: RequestInit): Promise<T> {
      const url = `${baseUrl}${endpoint}`
      const doFetch = async (): Promise<T> => {
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
            const bodyText = await res.text().catch(() => "")
            if (res.status === 502) {
              throw new Error(
                "1С не успел ответить (502). Часто это таймаут прокси при долгом ответе 1С — повторите запрос или проверьте доступность 1С."
              )
            }
            const detail = bodyText ? ` | ${bodyText.slice(0, 500)}` : ""
            throw new Error(`1С API error: ${res.status} ${res.statusText}${detail}`)
          }

          return res.json() as Promise<T>
        } catch (err) {
          clearTimeout(timeoutId)
          if (err instanceof Error && err.name === "AbortError") {
            throw new Error("Таймаут запроса к 1С. Сервис отвечает слишком долго.")
          }
          throw err
        }
      }

      try {
        return await doFetch()
      } catch (firstErr) {
        if (!isConnectOrNetworkError(firstErr)) throw firstErr
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
        return await doFetch()
      }
    },

    /**
     * GET с телом как ArrayBuffer. При таймауте соединения — один повтор.
     */
    async getArrayBuffer(endpoint: string, options?: RequestInit): Promise<{ data: ArrayBuffer; headers: Headers }> {
      const url = `${baseUrl}${endpoint}`
      const doFetch = async (): Promise<{ data: ArrayBuffer; headers: Headers }> => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), ONE_C_REQUEST_TIMEOUT_MS)
        const signal = options?.signal ?? controller.signal

        try {
          const res = await fetch(url, {
            ...options,
            method: "GET",
            signal,
            headers: {
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

          const data = await res.arrayBuffer()
          return { data, headers: res.headers }
        } catch (err) {
          clearTimeout(timeoutId)
          if (err instanceof Error && err.name === "AbortError") {
            throw new Error("Таймаут запроса к 1С. Сервис отвечает слишком долго.")
          }
          throw err
        }
      }

      try {
        return await doFetch()
      } catch (firstErr) {
        if (!isConnectOrNetworkError(firstErr)) throw firstErr
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
        return await doFetch()
      }
    },

    /**
     * Отправляет POST-запрос к 1С API. При таймауте соединения — один повтор.
     */
    async post<T = unknown>(endpoint: string, body: unknown, options?: RequestInit): Promise<T> {
      const url = `${baseUrl}${endpoint}`
      const doFetch = async (): Promise<T> => {
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

          return res.json() as Promise<T>
        } catch (err) {
          clearTimeout(timeoutId)
          if (err instanceof Error && err.name === "AbortError") {
            throw new Error("Таймаут запроса к 1С. Сервис отвечает слишком долго.")
          }
          throw err
        }
      }

      try {
        return await doFetch()
      } catch (firstErr) {
        if (!isConnectOrNetworkError(firstErr)) throw firstErr
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
        return await doFetch()
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
