-- Monitoreo de errores del frontend (sin servicios externos).
-- La app registra acá los errores de render y los no capturados de usuarios con sesión.
-- Solo el usuario puede insertar los suyos; solo un admin puede leerlos.

CREATE TABLE IF NOT EXISTS public.client_errors (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('render', 'error', 'unhandledrejection')),
  message text NOT NULL CHECK (length(message) <= 1000),
  stack text CHECK (stack IS NULL OR length(stack) <= 8000),
  url text CHECK (url IS NULL OR length(url) <= 1000),
  user_agent text CHECK (user_agent IS NULL OR length(user_agent) <= 500),
  release text CHECK (release IS NULL OR length(release) <= 100)
);

COMMENT ON TABLE public.client_errors IS 'Errores del frontend (ErrorBoundary y no capturados).';

CREATE INDEX IF NOT EXISTS idx_client_errors_created ON public.client_errors (created_at DESC);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_errors_insert_own ON public.client_errors;
CREATE POLICY client_errors_insert_own ON public.client_errors
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS client_errors_admin_read ON public.client_errors;
CREATE POLICY client_errors_admin_read ON public.client_errors
  FOR SELECT TO authenticated
  USING (public.is_app_admin());

-- Limpieza: se guardan 90 días.
CREATE OR REPLACE FUNCTION public.prune_client_errors()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM public.client_errors WHERE created_at < now() - interval '90 days';
$$;
