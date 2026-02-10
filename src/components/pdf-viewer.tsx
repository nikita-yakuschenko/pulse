"use client"

import { useState, useEffect, useRef } from "react"

interface PdfViewerProps {
  fileUrl: string
  fileName?: string
  zoom?: number
  className?: string
}

/**
 * Data URL → blob URL (Chrome ограничивает data URL в iframe ~2MB, большие PDF дают белый экран)
 */
async function toBlobUrlIfDataUrl(url: string): Promise<string> {
  if (!url.startsWith("data:")) return url
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  } catch {
    return url
  }
}

/**
 * Рендер PDF через нативный просмотрщик браузера (iframe/embed).
 * Это позволяет работать с PDF как с документом: выделять текст, копировать, искать и т.д.
 */
export function PdfViewer({ fileUrl, fileName, zoom = 1.0, className = "" }: PdfViewerProps) {
  const [error, setError] = useState<string | null>(null)
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Data URL → blob URL для обхода лимита Chrome (~2MB)
  const blobUrlRef = useRef<string | null>(null)
  useEffect(() => {
    if (!fileUrl) {
      setResolvedUrl(null)
      return
    }
    if (!fileUrl.startsWith("data:")) {
      setResolvedUrl(fileUrl)
      return
    }
    let cancelled = false
    toBlobUrlIfDataUrl(fileUrl).then((url) => {
      if (cancelled) {
        if (url !== fileUrl) URL.revokeObjectURL(url)
        return
      }
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = url
      setResolvedUrl(url)
    })
    return () => {
      cancelled = true
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [fileUrl])

  // Устанавливаем title iframe после загрузки, чтобы переопределить title из PDF
  useEffect(() => {
    if (iframeRef.current && fileName) {
      const iframe = iframeRef.current
      const setTitle = () => {
        // Устанавливаем атрибут title
        iframe.title = fileName
        iframe.setAttribute("title", fileName)
        
        // Пытаемся установить title через contentWindow (может не работать из-за CORS)
        try {
          if (iframe.contentWindow && iframe.contentDocument) {
            iframe.contentDocument.title = fileName
            // Также пытаемся установить через window.name
            iframe.contentWindow.name = fileName
          }
        } catch (e) {
          // Игнорируем ошибки CORS
        }
      }

      // Устанавливаем title сразу
      setTitle()
      
      // И после загрузки
      iframe.onload = () => {
        setTitle()
        // Периодически проверяем и устанавливаем title, так как браузер может его переопределять
        const interval = setInterval(() => {
          if (iframe.title !== fileName) {
            setTitle()
          }
        }, 100)
        
        // Останавливаем через 5 секунд
        setTimeout(() => clearInterval(interval), 5000)
      }
    }
  }, [fileName])

  const srcUrl = resolvedUrl ?? fileUrl

  // Используем нативный PDF viewer браузера через iframe
  // navpanes=0 - скрываем панель миниатюр по умолчанию
  // toolbar=1 - показываем панель инструментов
  // scrollbar=1 - показываем полосы прокрутки
  return (
    <div className={`flex-1 min-h-0 overflow-hidden ${className}`.trim()}>
      {error ? (
        <div className="flex items-center justify-center h-full py-12 text-sm text-destructive">
          {error}
        </div>
      ) : fileUrl.startsWith("data:") && !resolvedUrl ? (
        <div className="flex items-center justify-center h-full py-12 text-sm text-muted-foreground">
          Загрузка PDF…
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          src={`${srcUrl}#toolbar=1&navpanes=0&scrollbar=1&zoom=${Math.round(zoom * 100)}`}
          className="w-full h-full border-0 block"
          title={fileName || "PDF Viewer"}
          name={fileName || "PDF Viewer"}
          onError={() => setError("Не удалось загрузить PDF")}
          style={{
            // Увеличиваем масштаб через CSS transform для более точного контроля
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            width: `${100 / zoom}%`,
            height: `${100 / zoom}%`,
            margin: 0,
            padding: 0,
            display: "block",
          }}
        />
      )}
    </div>
  )
}
