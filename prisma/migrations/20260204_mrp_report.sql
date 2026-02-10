-- MRP-отчёт: заголовок
CREATE TABLE "mrp_report" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mrp_report_pkey" PRIMARY KEY ("id")
);

-- Спецификации в отчёте (код из 1С)
CREATE TABLE "mrp_report_specification" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "specificationCode" TEXT NOT NULL,
    "specificationName" TEXT,

    CONSTRAINT "mrp_report_specification_pkey" PRIMARY KEY ("id")
);

-- Результаты расчёта по материалам (снимок)
CREATE TABLE "mrp_report_result" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "unit" TEXT,
    "demandQty" DECIMAL(65,30) NOT NULL,
    "balanceQty" DECIMAL(65,30) NOT NULL,
    "purchaseQty" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "mrp_report_result_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "mrp_report_specification" ADD CONSTRAINT "mrp_report_specification_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "mrp_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mrp_report_result" ADD CONSTRAINT "mrp_report_result_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "mrp_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "mrp_report_specification_reportId_idx" ON "mrp_report_specification"("reportId");
CREATE INDEX "mrp_report_result_reportId_idx" ON "mrp_report_result"("reportId");
CREATE INDEX "mrp_report_userId_idx" ON "mrp_report"("userId");
