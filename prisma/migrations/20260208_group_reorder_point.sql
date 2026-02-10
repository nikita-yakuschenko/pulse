-- Add group reorder point support
ALTER TABLE "reorder_point" ADD COLUMN "isGroup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reorder_point" ADD COLUMN "itemCodes" JSONB;

-- Drop old unique constraint (group points don't have a single itemCode)
ALTER TABLE "reorder_point" DROP CONSTRAINT IF EXISTS "reorder_point_itemCode_userId_key";
