-- CreateTable: настройки групп номенклатуры по пользователю (избранное, скрытие)
CREATE TABLE "material_group_preference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_group_preference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_group_preference_userId_groupCode_key" ON "material_group_preference"("userId", "groupCode");
