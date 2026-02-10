-- Add warehouse codes to reorder point (which warehouses to track)
ALTER TABLE "reorder_point" ADD COLUMN IF NOT EXISTS "warehouseCodes" JSONB;
