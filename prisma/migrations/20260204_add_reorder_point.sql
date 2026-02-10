-- CreateTable
CREATE TABLE "reorder_point" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "reorderQuantity" DECIMAL(65,30) NOT NULL,
    "unit" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reorder_point_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reorder_point_itemCode_userId_key" ON "reorder_point"("itemCode", "userId");

-- AddForeignKey
ALTER TABLE "reorder_point" ADD CONSTRAINT "reorder_point_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
