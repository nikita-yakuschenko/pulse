-- Добавить номенклатурную группу в результаты MRP (из ответа спецификаций 1С)
ALTER TABLE "mrp_report_result" ADD COLUMN IF NOT EXISTS "nomenclatureGroup" TEXT;
