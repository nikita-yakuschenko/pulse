"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { IconCircleCheckFilled } from "@tabler/icons-react"

type IntegrationSettings = {
  "1c": {
    environment: "test" | "production"
    username: string
    password: string
    enabled: boolean
  }
  bitrix24: {
    webhookUrl: string
    enabled: boolean
  }
  telegram: {
    botToken: string
    enabled: boolean
  }
}

const ONE_C_URLS = {
  test: "https://api.module.team/module.team/hs/",
  production: "https://api.module.team/main/hs/",
} as const

export function IntegrationsSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  
  const [oneC, setOneC] = useState<IntegrationSettings["1c"]>({ environment: "test", username: "", password: "", enabled: false })
  const [bitrix, setBitrix] = useState({ webhookUrl: "", enabled: false })
  const [telegram, setTelegram] = useState({ botToken: "", enabled: false })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const meta = (user.user_metadata || {}) as Record<string, unknown>
      const integrations = (meta.integrations || {}) as Partial<IntegrationSettings>
      
      if (integrations["1c"]) {
        setOneC(integrations["1c"])
      }
      if (integrations.bitrix24) {
        setBitrix(integrations.bitrix24)
      }
      if (integrations.telegram) {
        setTelegram(integrations.telegram)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function save1C() {
    setSaving("1c")
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Не авторизован")
      
      const meta = (user.user_metadata || {}) as Record<string, unknown>
      const integrations = (meta.integrations || {}) as Partial<IntegrationSettings>
      
      const { error } = await supabase.auth.updateUser({
        data: {
          integrations: {
            ...integrations,
            "1c": oneC,
          },
        },
      })
      if (error) throw error
      toast.success("Настройки 1С сохранены.")
    } catch {
      toast.error("Не удалось сохранить настройки 1С.")
    } finally {
      setSaving(null)
    }
  }

  async function test1C() {
    setTesting("1c")
    try {
      const url = ONE_C_URLS[oneC.environment]
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "1c", settings: { ...oneC, url } }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Не удалось подключиться к 1С.")
        return
      }
      
      // Успешное подключение — автоматически сохраняем credentials
      toast.success("Подключение к 1С успешно!")
      
      // Автоматически сохраняем настройки после успешной проверки
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const meta = (user.user_metadata || {}) as Record<string, unknown>
        const integrations = (meta.integrations || {}) as Partial<IntegrationSettings>
        
        await supabase.auth.updateUser({
          data: {
            integrations: {
              ...integrations,
              "1c": { ...oneC, enabled: true }, // Автоматически включаем
            },
          },
        })
        
        setOneC({ ...oneC, enabled: true })
        toast.success("Настройки 1С автоматически сохранены.")
      }
    } catch {
      toast.error("Ошибка при проверке подключения.")
    } finally {
      setTesting(null)
    }
  }

  async function saveBitrix() {
    setSaving("bitrix24")
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Не авторизован")
      
      const meta = (user.user_metadata || {}) as Record<string, unknown>
      const integrations = (meta.integrations || {}) as Partial<IntegrationSettings>
      
      const { error } = await supabase.auth.updateUser({
        data: {
          integrations: {
            ...integrations,
            bitrix24: bitrix,
          },
        },
      })
      if (error) throw error
      toast.success("Настройки Битрикс24 сохранены.")
    } catch {
      toast.error("Не удалось сохранить настройки Битрикс24.")
    } finally {
      setSaving(null)
    }
  }

  async function testBitrix() {
    setTesting("bitrix24")
    try {
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "bitrix24", settings: bitrix }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Не удалось подключиться к Битрикс24.")
        return
      }
      toast.success("Подключение к Битрикс24 успешно!")
    } catch {
      toast.error("Ошибка при проверке подключения.")
    } finally {
      setTesting(null)
    }
  }

  async function saveTelegram() {
    setSaving("telegram")
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Не авторизован")
      
      const meta = (user.user_metadata || {}) as Record<string, unknown>
      const integrations = (meta.integrations || {}) as Partial<IntegrationSettings>
      
      const { error } = await supabase.auth.updateUser({
        data: {
          integrations: {
            ...integrations,
            telegram: telegram,
          },
        },
      })
      if (error) throw error
      toast.success("Настройки Telegram сохранены.")
    } catch {
      toast.error("Не удалось сохранить настройки Telegram.")
    } finally {
      setSaving(null)
    }
  }

  async function testTelegram() {
    setTesting("telegram")
    try {
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "telegram", settings: telegram }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Не удалось подключиться к Telegram боту.")
        return
      }
      toast.success("Бот Telegram доступен!")
    } catch {
      toast.error("Ошибка при проверке бота.")
    } finally {
      setTesting(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">Загрузка…</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Интеграции</CardTitle>
        <CardDescription>
          Подключение внешних систем: 1С, Битрикс24, Telegram
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {/* 1С */}
          <AccordionItem value="1c">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <span className="font-medium">1С</span>
                {oneC.enabled && (
                  <Badge variant="outline" className="text-muted-foreground px-1.5">
                    <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
                    Подключено
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  save1C()
                }}
                className="space-y-4"
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="1c-environment">Среда</FieldLabel>
                    <Select
                      value={oneC.environment}
                      onValueChange={(value: "test" | "production") =>
                        setOneC({ ...oneC, environment: value })
                      }
                    >
                      <SelectTrigger id="1c-environment" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="test">Тестовая (module.team)</SelectItem>
                        <SelectItem value="production">Боевая (main)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {ONE_C_URLS[oneC.environment]}
                    </p>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="1c-username">Логин (может быть кириллицей)</FieldLabel>
                    <Input
                      id="1c-username"
                      value={oneC.username}
                      onChange={(e) => setOneC({ ...oneC, username: e.target.value })}
                      placeholder="Иван или IvanUser"
                      className="w-full"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="1c-password">Пароль</FieldLabel>
                    <Input
                      id="1c-password"
                      type="password"
                      value={oneC.password}
                      onChange={(e) => setOneC({ ...oneC, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full"
                    />
                  </Field>
                  <Field>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={oneC.enabled}
                        onChange={(e) => setOneC({ ...oneC, enabled: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">Включить интеграцию</span>
                    </label>
                  </Field>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={!!saving}>
                      {saving === "1c" ? "Сохранение…" : "Сохранить"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!!testing || !oneC.username || !oneC.password}
                      onClick={test1C}
                    >
                      {testing === "1c" ? "Проверка…" : "Проверить подключение"}
                    </Button>
                  </div>
                </FieldGroup>
              </form>
            </AccordionContent>
          </AccordionItem>

          {/* Битрикс24 */}
          <AccordionItem value="bitrix24">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <span className="font-medium">Битрикс24</span>
                {bitrix.enabled && (
                  <Badge variant="outline" className="text-muted-foreground px-1.5">
                    <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
                    Подключено
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  saveBitrix()
                }}
                className="space-y-4"
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="bitrix-webhook">Webhook URL</FieldLabel>
                    <Input
                      id="bitrix-webhook"
                      type="url"
                      value={bitrix.webhookUrl}
                      onChange={(e) => setBitrix({ ...bitrix, webhookUrl: e.target.value })}
                      placeholder="https://ваш-портал.bitrix24.ru/rest/1/xxxxx/"
                      className="w-full"
                    />
                    <p className="text-muted-foreground mt-1 text-xs">
                      Вебхук входящий (Приложения → Вебхуки → Добавить вебхук)
                    </p>
                  </Field>
                  <Field>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={bitrix.enabled}
                        onChange={(e) => setBitrix({ ...bitrix, enabled: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">Включить интеграцию</span>
                    </label>
                  </Field>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={!!saving}>
                      {saving === "bitrix24" ? "Сохранение…" : "Сохранить"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!!testing || !bitrix.webhookUrl}
                      onClick={testBitrix}
                    >
                      {testing === "bitrix24" ? "Проверка…" : "Проверить подключение"}
                    </Button>
                  </div>
                </FieldGroup>
              </form>
            </AccordionContent>
          </AccordionItem>

          {/* Telegram */}
          <AccordionItem value="telegram">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <span className="font-medium">Telegram</span>
                {telegram.enabled && (
                  <Badge variant="outline" className="text-muted-foreground px-1.5">
                    <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
                    Подключено
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  saveTelegram()
                }}
                className="space-y-4"
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="telegram-token">Bot Token</FieldLabel>
                    <Input
                      id="telegram-token"
                      type="password"
                      value={telegram.botToken}
                      onChange={(e) => setTelegram({ ...telegram, botToken: e.target.value })}
                      placeholder="110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
                      className="w-full"
                    />
                    <p className="text-muted-foreground mt-1 text-xs">
                      Токен бота из @BotFather
                    </p>
                  </Field>
                  <Field>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={telegram.enabled}
                        onChange={(e) => setTelegram({ ...telegram, enabled: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">Включить интеграцию</span>
                    </label>
                  </Field>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={!!saving}>
                      {saving === "telegram" ? "Сохранение…" : "Сохранить"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!!testing || !telegram.botToken}
                      onClick={testTelegram}
                    >
                      {testing === "telegram" ? "Проверка…" : "Проверить бота"}
                    </Button>
                  </div>
                </FieldGroup>
              </form>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}
