-- Recordatorios semanales para enviar recursos por WhatsApp (como check_in_send_schedules)
CREATE TABLE IF NOT EXISTS public.trainer_resource_send_schedules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id           uuid NOT NULL REFERENCES public.trainer_resources(id) ON DELETE CASCADE,
  is_enabled            boolean NOT NULL DEFAULT true,
  day_of_week           int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  timezone              text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  prefer_group_whatsapp boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, resource_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_trainer_resource_send_schedules_owner
  ON public.trainer_resource_send_schedules(owner_id);

ALTER TABLE public.trainer_resource_send_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trainer_resource_send_schedules_owner ON public.trainer_resource_send_schedules;
CREATE POLICY trainer_resource_send_schedules_owner ON public.trainer_resource_send_schedules
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
