-- Переименование houseNo -> kitNo (номер домокомплекта/комплекта)

ALTER TABLE "contract" RENAME COLUMN "houseNo" TO "kitNo";
ALTER TABLE "mount_schedule_entry" RENAME COLUMN "houseNo" TO "kitNo";
