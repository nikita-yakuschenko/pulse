"use client"

import { useEffect, useRef, useState } from "react"

interface OfficeViewerProps {
  fileUrl: string
  fileName: string
  className?: string
}

/**
 * Компонент для отображения офисных документов (DOCX, XLSX, RTF и т.д.)
 * Рендерит документы как страницы, похожие на PDF
 */
export function OfficeViewer({ fileUrl, fileName, className = "" }: OfficeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const lowerFileName = (fileName || "").toLowerCase()

  useEffect(() => {
    if (!fileUrl || !fileName || !containerRef.current) return

    setLoading(true)
    setError(null)
    const container = containerRef.current
    container.innerHTML = "" // Очищаем контейнер

    // Для DOCX используем docx-preview для рендеринга как страницы документа
    if (lowerFileName.endsWith(".docx")) {
      Promise.all([
        import("docx-preview"),
        fetch(fileUrl).then((res) => res.arrayBuffer()),
      ])
        .then(([docxModule, arrayBuffer]) => {
          // docx-preview экспортирует renderAsync напрямую
          const renderAsync = docxModule.renderAsync
          
          if (!renderAsync || typeof renderAsync !== "function") {
            console.error("docx-preview module structure:", docxModule)
            throw new Error("renderAsync не найден в docx-preview")
          }
          
          // Рендерим DOCX как страницы документа
          renderAsync(arrayBuffer, container, undefined, {
            className: "docx-wrapper",
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            ignoreLastRenderedPageBreak: true,
            experimental: false,
            trimXmlDeclaration: true,
            useBase64URL: false,
            useMathMLPolyfill: true,
            showChanges: false,
            showComments: false,
            showInserted: true,
            showDeleted: false,
          })
          setLoading(false)
        })
        .catch((err) => {
          console.error("Ошибка загрузки DOCX:", err)
          setError("Не удалось загрузить документ. Попробуйте скачать файл.")
          setLoading(false)
        })
      return
    }

    // Для XLSX/XLS используем SheetJS (xlsx) — читает только данные листов, рисунки/диаграммы игнорируются
    if (lowerFileName.endsWith(".xlsx") || lowerFileName.endsWith(".xls")) {
      Promise.all([
        import("xlsx"),
        fetch(fileUrl).then((res) => res.arrayBuffer()),
      ])
        .then(([XLSXModule, arrayBuffer]) => {
          const XLSX = XLSXModule.default
          const workbook = XLSX.read(arrayBuffer, { type: "array", cellStyles: false })
          return { XLSX, workbook }
        })
        .then(({ XLSX, workbook }) => {
          const sheetNames = workbook.SheetNames || []
          if (sheetNames.length === 0) {
            setError("В файле нет листов.")
            setLoading(false)
            return
          }

          sheetNames.forEach((sheetName, index) => {
            const worksheet = workbook.Sheets[sheetName]
            if (!worksheet) return

            const pageDiv = document.createElement("div")
            pageDiv.className = "office-page bg-white shadow-sm mb-4 p-6"
            pageDiv.style.minHeight = "842px"
            pageDiv.style.width = "100%"
            pageDiv.style.maxWidth = "794px"
            pageDiv.style.margin = "0 auto"

            if (sheetNames.length > 1) {
              const title = document.createElement("h2")
              title.className = "text-lg font-semibold mb-4 pb-2 border-b"
              title.textContent = sheetName
              pageDiv.appendChild(title)
            }

            const html = XLSX.utils.sheet_to_html(worksheet, { id: `sheet-${index}` })
            const tableContainer = document.createElement("div")
            tableContainer.className = "overflow-x-auto"
            tableContainer.innerHTML = html

            const table = tableContainer.querySelector("table")
            if (table) {
              table.style.width = "100%"
              table.style.borderCollapse = "collapse"
              table.style.fontSize = "12px"
              table.style.fontFamily = "system-ui, -apple-system, sans-serif"
              table.querySelectorAll("td, th").forEach((el) => {
                const cell = el as HTMLElement
                cell.style.border = "1px solid #e5e7eb"
                cell.style.padding = "6px 8px"
                cell.style.textAlign = "left"
              })
              table.querySelectorAll("th").forEach((el) => {
                const th = el as HTMLElement
                th.style.backgroundColor = "#f9fafb"
                th.style.fontWeight = "600"
              })
              table.querySelectorAll("tr:nth-child(even)").forEach((el) => {
                (el as HTMLElement).style.backgroundColor = "#fafafa"
              })
            }

            pageDiv.appendChild(tableContainer)
            container.appendChild(pageDiv)
          })

          setLoading(false)
        })
        .catch((err) => {
          console.error("Ошибка загрузки Excel:", err)
          setError("Не удалось загрузить таблицу. Попробуйте скачать файл.")
          setLoading(false)
        })
      return
    }

    // Для остальных форматов (DOC, RTF) используем Google Docs Viewer
    // Google не может загрузить localhost — показываем сообщение
    const fullUrl =
      typeof window !== "undefined"
        ? fileUrl.startsWith("data:") || fileUrl.startsWith("http")
          ? fileUrl
          : `${window.location.origin}${fileUrl}`
        : fileUrl
    // Google Docs Viewer не может загрузить localhost или data URL
    const isUnreachableByGoogle =
      fullUrl.includes("localhost") ||
      fullUrl.includes("127.0.0.1") ||
      fullUrl.startsWith("data:")

    if (isUnreachableByGoogle) {
      setError(
        fullUrl.startsWith("data:")
          ? "Просмотр DOC/RTF в этом формате недоступен. Скачайте файл по кнопке ниже."
          : "Просмотр DOC/RTF в локальной сети недоступен. Скачайте файл по кнопке ниже."
      )
      setLoading(false)
      return
    }

    const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`

    const iframe = document.createElement("iframe")
    iframe.src = viewerUrl
    iframe.className = "w-full h-full border-0"
    iframe.title = fileName
    iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-popups allow-forms")
    iframe.onload = () => setLoading(false)
    iframe.onerror = () => {
      setError("Не удалось загрузить документ. Попробуйте скачать файл.")
      setLoading(false)
    }
    container.appendChild(iframe)
  }, [fileUrl, fileName, lowerFileName])

  return (
    <div className={`flex-1 min-h-0 overflow-auto bg-muted/10 ${className}`.trim()}>
      {loading && (
        <div className="flex items-center justify-center h-full py-12">
          <span className="text-sm text-muted-foreground">Загрузка документа…</span>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center h-full py-12">
          <div className="text-sm text-destructive text-center px-6">{error}</div>
        </div>
      )}
      <div ref={containerRef} className="py-4" />
    </div>
  )
}
