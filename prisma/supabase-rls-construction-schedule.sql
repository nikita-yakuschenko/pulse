-- RLS для таблиц модуля «График монтажа» (address, employee, project_catalog, contract, mount_schedule_entry)
-- Выполнить один раз: Supabase → SQL Editor → New query → вставить и Run
-- Доступ только для аутентифицированных пользователей (auth.uid() IS NOT NULL).
-- Приложение использует эти таблицы через API (Prisma); при подключении через service role / postgres RLS не применяется к серверным запросам.

-- 1) address
ALTER TABLE "address" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "construction_address_authenticated" ON "address";
CREATE POLICY "construction_address_authenticated" ON "address"
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2) employee
ALTER TABLE "employee" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "construction_employee_authenticated" ON "employee";
CREATE POLICY "construction_employee_authenticated" ON "employee"
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3) project_catalog
ALTER TABLE "project_catalog" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "construction_project_catalog_authenticated" ON "project_catalog";
CREATE POLICY "construction_project_catalog_authenticated" ON "project_catalog"
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4) contract
ALTER TABLE "contract" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "construction_contract_authenticated" ON "contract";
CREATE POLICY "construction_contract_authenticated" ON "contract"
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5) mount_schedule_entry
ALTER TABLE "mount_schedule_entry" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "construction_mount_schedule_entry_authenticated" ON "mount_schedule_entry";
CREATE POLICY "construction_mount_schedule_entry_authenticated" ON "mount_schedule_entry"
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
