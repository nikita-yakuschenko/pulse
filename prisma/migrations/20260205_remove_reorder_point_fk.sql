-- Удаление foreign key constraint для reorder_point
ALTER TABLE "reorder_point" DROP CONSTRAINT IF EXISTS "reorder_point_userId_fkey";
