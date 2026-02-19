-- Объект строительства (раздел Объекты) и привязка записей графика монтажа к объекту

CREATE TABLE "construction_object" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "construction_object_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "construction_object" ADD CONSTRAINT "construction_object_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "construction_object" ADD CONSTRAINT "construction_object_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "construction_object" ADD CONSTRAINT "construction_object_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "construction_object" ADD CONSTRAINT "construction_object_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "construction_object_addressId_idx" ON "construction_object"("addressId");
CREATE INDEX "construction_object_contractId_idx" ON "construction_object"("contractId");
CREATE INDEX "construction_object_projectId_idx" ON "construction_object"("projectId");
CREATE INDEX "construction_object_foremanId_idx" ON "construction_object"("foremanId");

ALTER TABLE "mount_schedule_entry" ADD COLUMN IF NOT EXISTS "objectId" TEXT;
ALTER TABLE "mount_schedule_entry" ADD COLUMN IF NOT EXISTS "mountStartDate" TIMESTAMP(3);
ALTER TABLE "mount_schedule_entry" ADD CONSTRAINT "mount_schedule_entry_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "construction_object"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "mount_schedule_entry_objectId_idx" ON "mount_schedule_entry"("objectId");
