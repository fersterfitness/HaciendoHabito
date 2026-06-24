-- Plan de alimentación tipo plantilla Excel (macros + grillas por sección), una fila por usuario.
CREATE TABLE IF NOT EXISTS public.nutrition_planning_workbooks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text NOT NULL DEFAULT 'Plan de alimentación',
  data       jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_planning_workbooks_owner_unique UNIQUE (owner_id)
);

DROP TRIGGER IF EXISTS set_updated_at ON public.nutrition_planning_workbooks;
SELECT public.set_updated_at('nutrition_planning_workbooks');

ALTER TABLE public.nutrition_planning_workbooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nutrition_planning_workbooks_owner_roles ON public.nutrition_planning_workbooks;
CREATE POLICY nutrition_planning_workbooks_owner_roles ON public.nutrition_planning_workbooks
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
