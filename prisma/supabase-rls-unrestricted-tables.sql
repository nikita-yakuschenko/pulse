-- RLS для таблиц, помеченных UNRESTRICTED в Supabase
-- Выполнить один раз: Supabase → SQL Editor → New query → вставить и Run
-- Логика: аутентифицированный пользователь видит/меняет только свои данные (userId = auth.uid())

-- 1) material_group_preference
ALTER TABLE "material_group_preference" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "material_group_preference_select" ON "material_group_preference";
DROP POLICY IF EXISTS "material_group_preference_insert" ON "material_group_preference";
DROP POLICY IF EXISTS "material_group_preference_update" ON "material_group_preference";
DROP POLICY IF EXISTS "material_group_preference_delete" ON "material_group_preference";

CREATE POLICY "material_group_preference_select" ON "material_group_preference"
  FOR SELECT TO authenticated USING ("userId" = auth.uid()::text);

CREATE POLICY "material_group_preference_insert" ON "material_group_preference"
  FOR INSERT TO authenticated WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "material_group_preference_update" ON "material_group_preference"
  FOR UPDATE TO authenticated USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "material_group_preference_delete" ON "material_group_preference"
  FOR DELETE TO authenticated USING ("userId" = auth.uid()::text);

-- 2) material_preference
ALTER TABLE "material_preference" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "material_preference_select" ON "material_preference";
DROP POLICY IF EXISTS "material_preference_insert" ON "material_preference";
DROP POLICY IF EXISTS "material_preference_update" ON "material_preference";
DROP POLICY IF EXISTS "material_preference_delete" ON "material_preference";

CREATE POLICY "material_preference_select" ON "material_preference"
  FOR SELECT TO authenticated USING ("userId" = auth.uid()::text);

CREATE POLICY "material_preference_insert" ON "material_preference"
  FOR INSERT TO authenticated WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "material_preference_update" ON "material_preference"
  FOR UPDATE TO authenticated USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "material_preference_delete" ON "material_preference"
  FOR DELETE TO authenticated USING ("userId" = auth.uid()::text);

-- 3) search_exclusion
ALTER TABLE "search_exclusion" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_exclusion_select" ON "search_exclusion";
DROP POLICY IF EXISTS "search_exclusion_insert" ON "search_exclusion";
DROP POLICY IF EXISTS "search_exclusion_update" ON "search_exclusion";
DROP POLICY IF EXISTS "search_exclusion_delete" ON "search_exclusion";

CREATE POLICY "search_exclusion_select" ON "search_exclusion"
  FOR SELECT TO authenticated USING ("userId" = auth.uid()::text);

CREATE POLICY "search_exclusion_insert" ON "search_exclusion"
  FOR INSERT TO authenticated WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "search_exclusion_update" ON "search_exclusion"
  FOR UPDATE TO authenticated USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "search_exclusion_delete" ON "search_exclusion"
  FOR DELETE TO authenticated USING ("userId" = auth.uid()::text);

-- 4) mrp_report
ALTER TABLE "mrp_report" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mrp_report_select" ON "mrp_report";
DROP POLICY IF EXISTS "mrp_report_insert" ON "mrp_report";
DROP POLICY IF EXISTS "mrp_report_update" ON "mrp_report";
DROP POLICY IF EXISTS "mrp_report_delete" ON "mrp_report";

CREATE POLICY "mrp_report_select" ON "mrp_report"
  FOR SELECT TO authenticated USING ("userId" = auth.uid()::text);

CREATE POLICY "mrp_report_insert" ON "mrp_report"
  FOR INSERT TO authenticated WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "mrp_report_update" ON "mrp_report"
  FOR UPDATE TO authenticated USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "mrp_report_delete" ON "mrp_report"
  FOR DELETE TO authenticated USING ("userId" = auth.uid()::text);

-- 5) mrp_report_specification (доступ только к спецификациям своих отчётов)
ALTER TABLE "mrp_report_specification" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mrp_report_specification_select" ON "mrp_report_specification";
DROP POLICY IF EXISTS "mrp_report_specification_insert" ON "mrp_report_specification";
DROP POLICY IF EXISTS "mrp_report_specification_update" ON "mrp_report_specification";
DROP POLICY IF EXISTS "mrp_report_specification_delete" ON "mrp_report_specification";

CREATE POLICY "mrp_report_specification_select" ON "mrp_report_specification"
  FOR SELECT TO authenticated USING (
    "reportId" IN (SELECT id FROM mrp_report WHERE "userId" = auth.uid()::text)
  );

CREATE POLICY "mrp_report_specification_insert" ON "mrp_report_specification"
  FOR INSERT TO authenticated WITH CHECK (
    "reportId" IN (SELECT id FROM mrp_report WHERE "userId" = auth.uid()::text)
  );

CREATE POLICY "mrp_report_specification_update" ON "mrp_report_specification"
  FOR UPDATE TO authenticated USING (
    "reportId" IN (SELECT id FROM mrp_report WHERE "userId" = auth.uid()::text)
  ) WITH CHECK (
    "reportId" IN (SELECT id FROM mrp_report WHERE "userId" = auth.uid()::text)
  );

CREATE POLICY "mrp_report_specification_delete" ON "mrp_report_specification"
  FOR DELETE TO authenticated USING (
    "reportId" IN (SELECT id FROM mrp_report WHERE "userId" = auth.uid()::text)
  );

-- 6) mrp_report_result (доступ только к результатам своих отчётов)
ALTER TABLE "mrp_report_result" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mrp_report_result_select" ON "mrp_report_result";
DROP POLICY IF EXISTS "mrp_report_result_insert" ON "mrp_report_result";
DROP POLICY IF EXISTS "mrp_report_result_update" ON "mrp_report_result";
DROP POLICY IF EXISTS "mrp_report_result_delete" ON "mrp_report_result";

CREATE POLICY "mrp_report_result_select" ON "mrp_report_result"
  FOR SELECT TO authenticated USING (
    "reportId" IN (SELECT id FROM mrp_report WHERE "userId" = auth.uid()::text)
  );

CREATE POLICY "mrp_report_result_insert" ON "mrp_report_result"
  FOR INSERT TO authenticated WITH CHECK (
    "reportId" IN (SELECT id FROM mrp_report WHERE "userId" = auth.uid()::text)
  );

CREATE POLICY "mrp_report_result_update" ON "mrp_report_result"
  FOR UPDATE TO authenticated USING (
    "reportId" IN (SELECT id FROM mrp_report WHERE "userId" = auth.uid()::text)
  ) WITH CHECK (
    "reportId" IN (SELECT id FROM mrp_report WHERE "userId" = auth.uid()::text)
  );

CREATE POLICY "mrp_report_result_delete" ON "mrp_report_result"
  FOR DELETE TO authenticated USING (
    "reportId" IN (SELECT id FROM mrp_report WHERE "userId" = auth.uid()::text)
  );
