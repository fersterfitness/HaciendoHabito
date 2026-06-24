-- Recordatorios de envío: permitir asociar una plantilla de texto (sin recurso con URL).

ALTER TABLE public.trainer_resource_send_schedules
  ALTER COLUMN resource_id DROP NOT NULL;

ALTER TABLE public.trainer_resource_send_schedules
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.trainer_message_templates(id) ON DELETE CASCADE;

ALTER TABLE public.trainer_resource_send_schedules
  DROP CONSTRAINT IF EXISTS trainer_resource_send_schedules_owner_id_resource_id_day_of_we_key;

ALTER TABLE public.trainer_resource_send_schedules
  DROP CONSTRAINT IF EXISTS trainer_resource_send_schedules_owner_id_resource_id_day_of_week_key;

ALTER TABLE public.trainer_resource_send_schedules
  ADD CONSTRAINT trainer_resource_send_schedules_target_chk
  CHECK (
    (resource_id IS NOT NULL AND template_id IS NULL)
    OR (resource_id IS NULL AND template_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_trainer_res_sched_resource_dow
  ON public.trainer_resource_send_schedules (owner_id, resource_id, day_of_week)
  WHERE resource_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trainer_res_sched_template_dow
  ON public.trainer_resource_send_schedules (owner_id, template_id, day_of_week)
  WHERE template_id IS NOT NULL;

COMMENT ON COLUMN public.trainer_resource_send_schedules.template_id IS
  'Plantilla de texto para recordatorio (mutuamente excluyente con resource_id).';

NOTIFY pgrst, 'reload schema';
