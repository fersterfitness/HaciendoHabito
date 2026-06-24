-- Catálogo muscle_groups: lectura para usuarios autenticados, alta solo trainer/admin.
-- Sin esto, el INSERT desde el cliente puede fallar según permisos por defecto del proyecto.

ALTER TABLE public.muscle_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS muscle_groups_select_authenticated ON public.muscle_groups;
CREATE POLICY muscle_groups_select_authenticated ON public.muscle_groups
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS muscle_groups_insert_trainer_admin ON public.muscle_groups;
CREATE POLICY muscle_groups_insert_trainer_admin ON public.muscle_groups
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(ARRAY['admin','trainer']::public.app_role[]));
