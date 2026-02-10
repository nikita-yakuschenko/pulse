-- Add section column to material_group_preference
ALTER TABLE "material_group_preference" ADD COLUMN "section" TEXT NOT NULL DEFAULT 'balance';

-- Drop old unique constraint and create new one with section
ALTER TABLE "material_group_preference" DROP CONSTRAINT IF EXISTS "material_group_preference_userId_groupCode_key";
CREATE UNIQUE INDEX "material_group_preference_userId_groupCode_section_key" ON "material_group_preference"("userId", "groupCode", "section");

-- Add section column to material_preference
ALTER TABLE "material_preference" ADD COLUMN "section" TEXT NOT NULL DEFAULT 'balance';

-- Drop old unique constraint and create new one with section
ALTER TABLE "material_preference" DROP CONSTRAINT IF EXISTS "material_preference_userId_materialCode_key";
CREATE UNIQUE INDEX "material_preference_userId_materialCode_section_key" ON "material_preference"("userId", "materialCode", "section");

-- Create search_exclusion table
CREATE TABLE "search_exclusion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT 'nomenclature',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_exclusion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "search_exclusion_userId_groupCode_section_key" ON "search_exclusion"("userId", "groupCode", "section");
