-- Включить RLS для таблицы reorder_point
ALTER TABLE IF EXISTS public.reorder_point ENABLE ROW LEVEL SECURITY;

-- Политика: пользователь видит только свои точки заказа
-- auth.uid() возвращает uuid, userId в базе — text, приводим типы
DROP POLICY IF EXISTS "Users can manage own reorder points" ON public.reorder_point;

CREATE POLICY "Users can manage own reorder points"
ON public.reorder_point
FOR ALL
TO authenticated
USING ("userId" = auth.uid()::text)
WITH CHECK ("userId" = auth.uid()::text);
