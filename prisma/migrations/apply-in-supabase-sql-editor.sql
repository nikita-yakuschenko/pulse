-- =============================================================================
-- Выполнить в Supabase: Project -> SQL Editor -> New query -> вставить -> Run
-- (подключение от имени владельца БД, поэтому не будет "must be owner of table")
-- =============================================================================

-- 1) Переименование houseNo -> kitNo (если ещё не переименовано)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contract' AND column_name = 'houseNo'
  ) THEN
    ALTER TABLE "contract" RENAME COLUMN "houseNo" TO "kitNo";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mount_schedule_entry' AND column_name = 'houseNo'
  ) THEN
    ALTER TABLE "mount_schedule_entry" RENAME COLUMN "houseNo" TO "kitNo";
  END IF;
END $$;

-- 2) Таблица construction_object (если ещё нет)
CREATE TABLE IF NOT EXISTS "construction_object" (
    "id" TEXT NOT NULL,
    "addressId" TEXT,
    "contractId" TEXT,
    "contractNumber" TEXT NOT NULL,
    "kitNo" INTEGER,
    "buildType" TEXT,
    "projectId" TEXT,
    "projectName" TEXT,
    "foremanId" TEXT,
    "foremanName" TEXT,
    "amountCurrent" DECIMAL(65,30),
    "amountNext" DECIMAL(65,30),
    "contractStartDate" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "construction_object_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "construction_object" DROP CONSTRAINT IF EXISTS "construction_object_addressId_fkey";
ALTER TABLE "construction_object" ADD CONSTRAINT "construction_object_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "construction_object" DROP CONSTRAINT IF EXISTS "construction_object_contractId_fkey";
ALTER TABLE "construction_object" ADD CONSTRAINT "construction_object_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "construction_object" DROP CONSTRAINT IF EXISTS "construction_object_projectId_fkey";
ALTER TABLE "construction_object" ADD CONSTRAINT "construction_object_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "construction_object" DROP CONSTRAINT IF EXISTS "construction_object_foremanId_fkey";
ALTER TABLE "construction_object" ADD CONSTRAINT "construction_object_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "construction_object_addressId_idx" ON "construction_object"("addressId");
CREATE INDEX IF NOT EXISTS "construction_object_contractId_idx" ON "construction_object"("contractId");
CREATE INDEX IF NOT EXISTS "construction_object_projectId_idx" ON "construction_object"("projectId");
CREATE INDEX IF NOT EXISTS "construction_object_foremanId_idx" ON "construction_object"("foremanId");

-- 3) Колонки в mount_schedule_entry
ALTER TABLE "mount_schedule_entry" ADD COLUMN IF NOT EXISTS "objectId" TEXT;
ALTER TABLE "mount_schedule_entry" ADD COLUMN IF NOT EXISTS "mountStartDate" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mount_schedule_entry_objectId_fkey'
  ) THEN
    ALTER TABLE "mount_schedule_entry" ADD CONSTRAINT "mount_schedule_entry_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "construction_object"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "mount_schedule_entry_objectId_idx" ON "mount_schedule_entry"("objectId");
