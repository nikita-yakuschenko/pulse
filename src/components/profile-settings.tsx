"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { IconCamera } from "@tabler/icons-react"

export function ProfileSettings() {
  const [name, setName] = useState("")
  const [lastName, setLastName] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [email, setEmail] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const meta = (user.user_metadata || {}) as Record<string, unknown>
      setName((meta.name as string) || (meta.full_name as string)?.split(" ")[0] || user.email?.split("@")[0] || "")
      setLastName((meta.last_name as string) || (meta.full_name as string)?.split(" ").slice(1).join(" ") || "")
      setJobTitle((meta.job_title as string) || "")
      setEmail(user.email ?? "")
      setAvatarUrl((meta.avatar_url as string) || "")
      setLoading(false)
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const supabase = createClient()
      const fullName = [name.trim(), lastName.trim()].filter(Boolean).join(" ")
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName || null,
          name: name.trim() || null,
          last_name: lastName.trim() || null,
          job_title: jobTitle.trim() || null,
        },
      })
      if (error) throw error
      toast.success("Профиль сохранён.")
    } catch (err) {
      toast.error("Не удалось сохранить профиль.")
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set("file", file)
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Не удалось загрузить фото.")
        return
      }
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: data.url },
      })
      if (error) throw error
      setAvatarUrl(data.url)
      toast.success("Фото обновлено.")
    } catch {
      toast.error("Не удалось обновить фото.")
    } finally {
      setUploading(false)
      e.target.value = ""
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

  const initials =
    (name?.slice(0, 1) || "") + (lastName?.slice(0, 1) || "")
      ? (name?.slice(0, 1) + (lastName?.slice(0, 1) || "")).toUpperCase()
      : name?.slice(0, 2).toUpperCase() || email?.slice(0, 2).toUpperCase() || "??"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Профиль</CardTitle>
        <CardDescription>
          Имя, должность и фото для отображения в приложении
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel>Фото</FieldLabel>
              <div className="flex items-center gap-4">
                <label className="relative cursor-pointer">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={avatarUrl} alt={name} />
                    <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="bg-muted/80 absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition-opacity hover:opacity-100">
                    <IconCamera className="size-8" />
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={uploading}
                    onChange={handleAvatarChange}
                  />
                </label>
                <div className="text-muted-foreground text-sm">
                  {uploading ? "Загрузка…" : "Нажмите на фото для загрузки. JPEG, PNG или WebP, до 2 МБ."}
                </div>
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-name">Имя</FieldLabel>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Иван"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-lastname">Фамилия</FieldLabel>
              <Input
                id="profile-lastname"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Иванов"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-job">Должность</FieldLabel>
              <Input
                id="profile-job"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Менеджер по закупкам"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-email">Email</FieldLabel>
              <Input
                id="profile-email"
                type="email"
                value={email}
                disabled
                className="bg-muted"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Email изменить нельзя. Используется для входа.
              </p>
            </Field>
            <Button type="submit" disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
