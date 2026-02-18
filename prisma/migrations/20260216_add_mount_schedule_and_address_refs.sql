-- График монтажа: справочники и записи графика (Address, Employee, ProjectCatalog, Contract, MountScheduleEntry)

CREATE TABLE "address" (
    "id" TEXT NOT NULL,
    "region" TEXT,
    "district" TEXT,
    "locality" TEXT,
    "street" TEXT,
    "house" TEXT,
    "fullText" TEXT,
    "kladrCode" TEXT,
    "fiasId" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "address_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_catalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_catalog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "houseNo" INTEGER,
    "addressId" TEXT,
    "buildType" TEXT,
    "projectId" TEXT,
    "foremanId" TEXT,
    "amount" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mount_schedule_entry" (
    "id" TEXT NOT NULL,
    "planMonth" TIMESTAMP(3) NOT NULL,
    "contractId" TEXT,
    "contractNumber" TEXT NOT NULL,
    "houseNo" INTEGER,
    "addressId" TEXT,
    "buildType" TEXT,
    "projectId" TEXT,
    "projectName" TEXT,
    "foremanId" TEXT,
    "foremanName" TEXT,
    "amountCurrent" DECIMAL(65,30),
    "amountNext" DECIMAL(65,30),
    "stage" TEXT,
    "escrowEgrnStatus" TEXT,
    "productionStatus" TEXT,
    "statusSummaryOverride" TEXT,
    "productionLaunchDate" TIMESTAMP(3),
    "productionNote" TEXT,
    "pilesDate" TIMESTAMP(3),
    "pilesRaw" TEXT,
    "shipmentDate" TIMESTAMP(3),
    "shipmentRaw" TEXT,
    "windowsRaw" TEXT,
    "windowsInstallRaw" TEXT,
    "roofRaw" TEXT,
    "roofWorkDate" TIMESTAMP(3),
    "roofWorkRaw" TEXT,
    "electricRaw" TEXT,
    "plumbingRaw" TEXT,
    "screedRaw" TEXT,
    "exteriorRaw" TEXT,
    "handoverDate" TIMESTAMP(3),
    "handoverRaw" TEXT,
    "comment" TEXT,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mount_schedule_entry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "contract" ADD CONSTRAINT "contract_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract" ADD CONSTRAINT "contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract" ADD CONSTRAINT "contract_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mount_schedule_entry" ADD CONSTRAINT "mount_schedule_entry_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mount_schedule_entry" ADD CONSTRAINT "mount_schedule_entry_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mount_schedule_entry" ADD CONSTRAINT "mount_schedule_entry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mount_schedule_entry" ADD CONSTRAINT "mount_schedule_entry_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "contract_addressId_idx" ON "contract"("addressId");
CREATE INDEX "contract_projectId_idx" ON "contract"("projectId");
CREATE INDEX "contract_foremanId_idx" ON "contract"("foremanId");
CREATE INDEX "mount_schedule_entry_planMonth_idx" ON "mount_schedule_entry"("planMonth");
CREATE INDEX "mount_schedule_entry_contractId_idx" ON "mount_schedule_entry"("contractId");
CREATE INDEX "mount_schedule_entry_addressId_idx" ON "mount_schedule_entry"("addressId");
CREATE INDEX "mount_schedule_entry_projectId_idx" ON "mount_schedule_entry"("projectId");
CREATE INDEX "mount_schedule_entry_foremanId_idx" ON "mount_schedule_entry"("foremanId");
