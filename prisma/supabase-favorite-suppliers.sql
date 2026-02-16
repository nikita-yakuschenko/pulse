-- Избранные поставщики пользователя. Данные храним в своей БД, работа с избранными — из неё.
-- Выполнить в SQL Editor Supabase Studio один раз.

CREATE TABLE IF NOT EXISTS public.favorite_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_code text NOT NULL,
  supplier_name text,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, supplier_code)
);

CREATE INDEX IF NOT EXISTS idx_favorite_suppliers_user_id ON public.favorite_suppliers(user_id);

ALTER TABLE public.favorite_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own favorite suppliers" ON public.favorite_suppliers;
CREATE POLICY "Users can manage own favorite suppliers"
ON public.favorite_suppliers
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
