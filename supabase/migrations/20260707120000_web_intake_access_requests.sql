-- Solicitudes de acceso al paso «Datos» del formulario público /form.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'intake_acceso_solicitado';

CREATE TABLE public.web_intake_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  selected_web_plan_slug text NOT NULL,
  selected_plan_title text,
  applicant_name text,
  applicant_email text,
  applicant_phone text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  owner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  reviewed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_web_intake_access_owner_status
  ON public.web_intake_access_requests (owner_id, status, created_at DESC);

CREATE INDEX idx_web_intake_access_token
  ON public.web_intake_access_requests (request_token);

ALTER TABLE public.web_intake_access_requests ENABLE ROW LEVEL SECURITY;

-- Staff (owner del registro): ver y actualizar solicitudes propias.
CREATE POLICY web_intake_access_owner_select ON public.web_intake_access_requests
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY web_intake_access_owner_update ON public.web_intake_access_requests
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

COMMENT ON TABLE public.web_intake_access_requests IS
  'Permisos para completar /form paso Datos; el visitante usa request_token (anon vía edge).';
