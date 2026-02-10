-- CreateTable: избранные материалы по пользователю
CREATE TABLE "material_preference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_preference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_preference_userId_materialCode_key" ON "material_preference"("userId", "materialCode");
