-- Permite al trainer marcar una respuesta de check-in como "respondida" (después
-- de contestar al alumno por WhatsApp/manualmente) y dejar una nota privada
-- opcional. Ambos campos viven en la respuesta, no en la invitación, porque solo
-- tienen sentido una vez que el alumno completó el formulario.

ALTER TABLE public.check_in_responses
  ADD COLUMN IF NOT EXISTS trainer_replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS trainer_note text;

COMMENT ON COLUMN public.check_in_responses.trainer_replied_at IS
  'Timestamp en que el trainer marca el check-in como respondido. NULL = pendiente.';
COMMENT ON COLUMN public.check_in_responses.trainer_note IS
  'Nota privada del trainer sobre esta respuesta (no se muestra al alumno).';

-- Índice para listar pendientes de respuesta en el dashboard ("X respuestas sin
-- contestar"). Pequeño y selectivo: la mayoría de las filas pasan a no-NULL.
CREATE INDEX IF NOT EXISTS idx_check_in_responses_trainer_pending
  ON public.check_in_responses (invite_id)
  WHERE trainer_replied_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC `set_check_in_response_trainer_status`
-- Toggle del estado + nota, validando que la respuesta pertenezca a un form
-- del trainer autenticado. Usar RPC en vez de RLS evita tener que tocar las
-- policies existentes (que viven en la base remota y no en este repo).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_check_in_response_trainer_status(
  p_response_id uuid,
  p_replied     boolean,
  p_note        text DEFAULT NULL
)
RETURNS public.check_in_responses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_response check_in_responses;
  v_form_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  -- Resolver el dueño del form via response → invite → form.
  SELECT f.owner_id INTO v_form_owner
  FROM check_in_responses cr
  JOIN check_in_invites  ci ON ci.id = cr.invite_id
  JOIN check_in_forms    f  ON f.id  = ci.form_id
  WHERE cr.id = p_response_id;

  IF v_form_owner IS NULL THEN
    RAISE EXCEPTION 'response not found' USING errcode = 'P0001';
  END IF;

  IF v_form_owner <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized' USING errcode = '42501';
  END IF;

  UPDATE check_in_responses
  SET trainer_replied_at = CASE
        WHEN p_replied THEN COALESCE(trainer_replied_at, now())
        ELSE NULL
      END,
      trainer_note = NULLIF(btrim(COALESCE(p_note, '')), '')
  WHERE id = p_response_id
  RETURNING * INTO v_response;

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.set_check_in_response_trainer_status(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_check_in_response_trainer_status(uuid, boolean, text) TO authenticated;

COMMENT ON FUNCTION public.set_check_in_response_trainer_status(uuid, boolean, text) IS
  'Marca/desmarca un check-in como respondido por el trainer y permite dejar una nota privada. Verifica ownership del form.';
