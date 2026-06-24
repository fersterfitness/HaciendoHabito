-- Rate limit del formulario público /form (reemplaza mapa en memoria de la edge function).

CREATE TABLE IF NOT EXISTS public.public_intake_rate_limit (
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_hash, created_at)
);

CREATE INDEX IF NOT EXISTS idx_public_intake_rate_limit_lookup
  ON public.public_intake_rate_limit (ip_hash, created_at DESC);

ALTER TABLE public.public_intake_rate_limit ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.public_intake_rate_limit IS 'Ventana deslizante por IP para public-intake-form.';

CREATE OR REPLACE FUNCTION public.intake_rate_limit_allow(
  p_ip text,
  p_max int DEFAULT 5,
  p_window_seconds int DEFAULT 600
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_count int;
BEGIN
  IF p_ip IS NULL OR trim(p_ip) = '' THEN
    p_ip := 'unknown';
  END IF;

  v_hash := md5(trim(p_ip));

  DELETE FROM public.public_intake_rate_limit
  WHERE created_at < now() - make_interval(secs => p_window_seconds);

  SELECT count(*)::int INTO v_count
  FROM public.public_intake_rate_limit
  WHERE ip_hash = v_hash
    AND created_at > now() - make_interval(secs => p_window_seconds);

  IF v_count >= p_max THEN
    RETURN false;
  END IF;

  INSERT INTO public.public_intake_rate_limit (ip_hash)
  VALUES (v_hash);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.intake_rate_limit_allow(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.intake_rate_limit_allow(text, int, int) TO service_role;
