-- Idempotente: misma política que init (EXISTS profiles, sin has_any_role en WITH CHECK).
DROP POLICY IF EXISTS nutrition_food_library_nutritionist_admin_owner ON public.nutrition_food_library;
CREATE POLICY nutrition_food_library_nutritionist_admin_owner ON public.nutrition_food_library
  FOR ALL USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['admin', 'nutritionist', 'trainer']::public.app_role[])
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['admin', 'nutritionist', 'trainer']::public.app_role[])
    )
  );
