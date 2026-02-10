-- RLS политики для Supabase
-- Выполнить в SQL Editor Supabase Studio
-- Ограничивает доступ: только авторизованные пользователи (JWT) получают доступ к данным

-- Таблицы из Prisma схемы
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'account', 'balance', 'mfa_code', 'payment', 'plan', 'reorder_point', 'session',
    'sorder', 'specification', 'supplier', 'user',
    'verification', 'warehouse'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ВАЖНО: для mfa_code нужна изоляция по userId!
-- Удаляем старую политику "все доступно всем authenticated"
DROP POLICY IF EXISTS "Authenticated full access" ON public.mfa_code;

-- Новая политика: пользователь видит только свои коды
-- auth.uid() возвращает uuid, userId в базе — text, приводим типы
CREATE POLICY "Users can manage own MFA codes"
ON public.mfa_code
FOR ALL
TO authenticated
USING ("userId" = auth.uid()::text)
WITH CHECK ("userId" = auth.uid()::text);

-- ВАЖНО: для reorder_point нужна изоляция по userId!
-- Каждый пользователь видит только свои точки заказа
DROP POLICY IF EXISTS "Users can manage own reorder points" ON public.reorder_point;

CREATE POLICY "Users can manage own reorder points"
ON public.reorder_point
FOR ALL
TO authenticated
USING ("userId" = auth.uid()::text)
WITH CHECK ("userId" = auth.uid()::text);

-- Остальные таблицы: авторизованные пользователи (authenticated) — полный доступ
-- Анонимные запросы (anon без JWT) — заблокированы
-- Удаляем существующие политики перед созданием (идемпотентность)

DROP POLICY IF EXISTS "Authenticated full access" ON public.account;
CREATE POLICY "Authenticated full access" ON public.account
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access" ON public.balance;
CREATE POLICY "Authenticated full access" ON public.balance
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access" ON public.payment;
CREATE POLICY "Authenticated full access" ON public.payment
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access" ON public.plan;
CREATE POLICY "Authenticated full access" ON public.plan
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access" ON public.session;
CREATE POLICY "Authenticated full access" ON public.session
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access" ON public.sorder;
CREATE POLICY "Authenticated full access" ON public.sorder
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access" ON public.specification;
CREATE POLICY "Authenticated full access" ON public.specification
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access" ON public.supplier;
CREATE POLICY "Authenticated full access" ON public.supplier
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access" ON public."user";
CREATE POLICY "Authenticated full access" ON public."user"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access" ON public.verification;
CREATE POLICY "Authenticated full access" ON public.verification
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access" ON public.warehouse;
CREATE POLICY "Authenticated full access" ON public.warehouse
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
