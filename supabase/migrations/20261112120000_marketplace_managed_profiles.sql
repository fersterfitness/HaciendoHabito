-- Marketplace: una cuenta da de alta y administra los perfiles de OTROS profesionales.
-- Correr después de 20261110120000_marketplace.sql. No borra datos.
--
-- 1) marketplace_professionals.user_id pasa a ser opcional (la cuenta del propio profesional, si la tiene)
--    y se agrega managed_by: quién cargó el perfil y lo administra.
-- 2) Quien administra un perfil lo edita, carga sus planes, ve sus solicitudes y lo publica sin esperar
--    aprobación. El admin conserva «oculto», «verificado» y «destacado».
-- 3) Bucket público marketplace-photos para subir la foto de cada profesional.
BEGIN;

ALTER TABLE public.marketplace_professionals ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.marketplace_professionals
  ADD COLUMN IF NOT EXISTS managed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.marketplace_professionals SET managed_by = user_id WHERE managed_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_mkt_prof_managed_by ON public.marketplace_professionals(managed_by);

CREATE OR REPLACE FUNCTION public.guard_marketplace_professional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Sin sesión de usuario (SQL Editor, service role): sin restricciones.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_app_admin() THEN
    IF TG_OP = 'INSERT' AND NEW.managed_by IS NULL THEN
      NEW.managed_by := auth.uid();
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.managed_by := auth.uid();
    -- Solo puede enlazar su propia cuenta; el perfil de otra persona queda sin cuenta.
    IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
      NEW.user_id := NULL;
    END IF;
    NEW.verificado := false;
    NEW.destacado := false;
    IF NEW.estado NOT IN ('borrador', 'pendiente', 'aprobado') THEN
      NEW.estado := 'borrador';
    END IF;
    RETURN NEW;
  END IF;

  NEW.user_id := OLD.user_id;
  NEW.managed_by := OLD.managed_by;
  NEW.verificado := OLD.verificado;
  NEW.destacado := OLD.destacado;
  IF OLD.estado = 'oculto' THEN
    -- Lo bajó el admin: se pueden editar los datos pero no volver a publicarlo.
    NEW.estado := OLD.estado;
  ELSIF NEW.estado NOT IN ('borrador', 'pendiente', 'aprobado') THEN
    NEW.estado := OLD.estado;
  END IF;
  RETURN NEW;
END;
$$;

-- ¿La sesión administra este perfil? (dueño de la cuenta, quien lo cargó, o admin)
CREATE OR REPLACE FUNCTION public.manages_marketplace_professional(p_professional_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_app_admin() OR EXISTS (
    SELECT 1 FROM public.marketplace_professionals p
    WHERE p.id = p_professional_id AND (p.user_id = auth.uid() OR p.managed_by = auth.uid())
  )
$$;

REVOKE ALL ON FUNCTION public.manages_marketplace_professional(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manages_marketplace_professional(uuid) TO authenticated;

DROP POLICY IF EXISTS mkt_prof_own_read ON public.marketplace_professionals;
CREATE POLICY mkt_prof_own_read ON public.marketplace_professionals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR managed_by = auth.uid() OR public.is_app_admin());

-- El disparador de arriba fija managed_by = auth.uid(), así que alcanza con pedir el rol.
DROP POLICY IF EXISTS mkt_prof_own_insert ON public.marketplace_professionals;
CREATE POLICY mkt_prof_own_insert ON public.marketplace_professionals
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(ARRAY['admin', 'trainer', 'nutritionist', 'psychologist']::public.app_role[]));

DROP POLICY IF EXISTS mkt_prof_own_update ON public.marketplace_professionals;
CREATE POLICY mkt_prof_own_update ON public.marketplace_professionals
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR managed_by = auth.uid() OR public.is_app_admin())
  WITH CHECK (user_id = auth.uid() OR managed_by = auth.uid() OR public.is_app_admin());

DROP POLICY IF EXISTS mkt_prof_admin_delete ON public.marketplace_professionals;
DROP POLICY IF EXISTS mkt_prof_own_delete ON public.marketplace_professionals;
CREATE POLICY mkt_prof_own_delete ON public.marketplace_professionals
  FOR DELETE TO authenticated
  USING (managed_by = auth.uid() OR public.is_app_admin());

DROP POLICY IF EXISTS mkt_plan_own_all ON public.marketplace_plans;
CREATE POLICY mkt_plan_own_all ON public.marketplace_plans
  FOR ALL TO authenticated
  USING (public.manages_marketplace_professional(professional_id))
  WITH CHECK (public.manages_marketplace_professional(professional_id));

DROP POLICY IF EXISTS mkt_req_own_read ON public.marketplace_requests;
CREATE POLICY mkt_req_own_read ON public.marketplace_requests
  FOR SELECT TO authenticated
  USING (public.manages_marketplace_professional(professional_id));

DROP POLICY IF EXISTS mkt_req_own_update ON public.marketplace_requests;
CREATE POLICY mkt_req_own_update ON public.marketplace_requests
  FOR UPDATE TO authenticated
  USING (public.manages_marketplace_professional(professional_id))
  WITH CHECK (public.manages_marketplace_professional(professional_id));

-- Fotos de los profesionales: {auth.uid()}/{archivo}. Lectura pública (las muestra la web).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('marketplace-photos', 'marketplace-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS marketplace_photos_public_read ON storage.objects;
CREATE POLICY marketplace_photos_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id::text = 'marketplace-photos');

DROP POLICY IF EXISTS marketplace_photos_owner_insert ON storage.objects;
CREATE POLICY marketplace_photos_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id::text = 'marketplace-photos' AND split_part(name::text, '/', 1) = auth.uid()::text);

DROP POLICY IF EXISTS marketplace_photos_owner_update ON storage.objects;
CREATE POLICY marketplace_photos_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id::text = 'marketplace-photos' AND split_part(name::text, '/', 1) = auth.uid()::text)
  WITH CHECK (bucket_id::text = 'marketplace-photos' AND split_part(name::text, '/', 1) = auth.uid()::text);

DROP POLICY IF EXISTS marketplace_photos_owner_delete ON storage.objects;
CREATE POLICY marketplace_photos_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id::text = 'marketplace-photos' AND split_part(name::text, '/', 1) = auth.uid()::text);

COMMIT;

NOTIFY pgrst, 'reload schema';
