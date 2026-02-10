import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "avatars"
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Необходима авторизация." }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Неверный запрос." }, { status: 400 })
  }

  const file = formData.get("file")
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Файл не выбран." }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Разрешены только изображения: JPEG, PNG, WebP." },
      { status: 400 }
    )
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Размер файла не более 2 МБ." },
      { status: 400 }
    )
  }

  const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp"
  const path = `${user.id}/avatar.${ext}`

  let { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })

  // Если бакет не найден — пробуем создать через service role и повторить загрузку
  const bucketMissing =
    uploadError &&
    (String(uploadError.message).includes("Bucket not found") || (uploadError as { statusCode?: string }).statusCode === "404")
  if (bucketMissing && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient()
      const { error: createErr } = await admin.storage.createBucket(BUCKET, { public: true })
      if (!createErr) {
        const retry = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
        uploadError = retry.error
      }
    } catch {
      // оставляем исходную uploadError для ответа
    }
  }

  if (uploadError) {
    console.error("Avatar upload error", uploadError)
    return NextResponse.json(
      { error: "Не удалось загрузить фото. Создайте bucket «avatars» в Supabase Storage (см. docs/profile-avatars.md)." },
      { status: 500 }
    )
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: urlData.publicUrl })
}
