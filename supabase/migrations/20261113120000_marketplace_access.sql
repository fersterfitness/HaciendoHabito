-- Marketplace: darle al profesional su propia cuenta en la app.
-- Correr después de 20261112120000_marketplace_managed_profiles.sql. No borra datos.
--
-- 1) marketplace_access: qué cuenta se le creó (o vinculó) a cada perfil y con qué correo.
--    El correo NO va en marketplace_professionals porque esa tabla la lee la web pública.
--    Solo escribe el servidor (api/marketplace-access, con service role): no hay políticas de
--    INSERT/UPDATE/DELETE para la app.
-- 2) can_grant_marketplace_access(): quién puede crear cuentas. El admin y el superadmin de
--    Finanzas (Tomi). Un profesional invitado no puede invitar a otros.
-- 3) mark_marketplace_access_active(): el profesional la llama al crear su contraseña.
BEGIN;

CREATE TABLE IF NOT EXISTS public.marketplace_access (
  professional_id uuid PRIMARY KEY REFERENCES public.marketplace_professionals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  -- true: la cuenta se creó con esta invitación · false: ya existía y solo se vinculó
  created_account boolean NOT NULL DEFAULT true,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,

  CONSTRAINT mkt_access_email_len CHECK (char_length(email) BETWEEN 5 AND 160)
);

CREATE INDEX IF NOT EXISTS idx_mkt_access_user ON public.marketplace_access(user_id);

ALTER TABLE public.marketplace_access ENABLE ROW LEVEL SECURITY;

-- Lo ve quien administra el perfil (quien lo cargó, el propio profesional o el admin).
DROP POLICY IF EXISTS mkt_access_read ON public.marketplace_access;
CREATE POLICY mkt_access_read ON public.marketplace_access
  FOR SELECT TO authenticated
  USING (public.manages_marketplace_professional(professional_id));

REVOKE ALL ON public.marketplace_access FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.marketplace_access FROM authenticated;
GRANT SELECT ON public.marketplace_access TO authenticated;

CREATE OR REPLACE FUNCTION public.can_grant_marketplace_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_app_admin()
    OR COALESCE((SELECT p.is_finance_superadmin FROM public.profiles p WHERE p.id = auth.uid()), false)
$$;

REVOKE ALL ON FUNCTION public.can_grant_marketplace_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_grant_marketplace_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_marketplace_access_active()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.marketplace_access
  SET activated_at = now()
  WHERE user_id = auth.uid() AND activated_at IS NULL
$$;

REVOKE ALL ON FUNCTION public.mark_marketplace_access_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_marketplace_access_active() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
