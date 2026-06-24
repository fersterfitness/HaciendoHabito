-- Permite marcar como restaurado desde la app (fallback si falta RPC en cache).

DROP POLICY IF EXISTS student_deletion_log_mark_restored ON public.student_deletion_log;
CREATE POLICY student_deletion_log_mark_restored ON public.student_deletion_log
  FOR UPDATE TO authenticated
  USING (
    restored_at IS NULL
    AND deleted_by IS NOT NULL
    AND (
      primary_owner_id = auth.uid()
      OR public.has_any_role(ARRAY['admin']::public.app_role[])
    )
  )
  WITH CHECK (
    restored_at IS NOT NULL
    AND (
      primary_owner_id = auth.uid()
      OR public.has_any_role(ARRAY['admin']::public.app_role[])
    )
  );

NOTIFY pgrst, 'reload schema';
