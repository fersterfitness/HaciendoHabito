-- Extender el enum payment_method con los nuevos métodos de pago argentinos.
-- ALTER TYPE ... ADD VALUE es idempotente-safe usando IF NOT EXISTS (Postgres 9.6+).

DO $$
BEGIN
  -- Efectivo en pesos (ARS)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_method' AND e.enumlabel = 'efectivo_ars'
  ) THEN
    ALTER TYPE payment_method ADD VALUE 'efectivo_ars';
  END IF;

  -- Cuenta DNI (Banco Nación)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_method' AND e.enumlabel = 'cuenta_dni'
  ) THEN
    ALTER TYPE payment_method ADD VALUE 'cuenta_dni';
  END IF;

  -- MercadoPago
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_method' AND e.enumlabel = 'mercadopago'
  ) THEN
    ALTER TYPE payment_method ADD VALUE 'mercadopago';
  END IF;

  -- Débito (tarjeta)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_method' AND e.enumlabel = 'debito'
  ) THEN
    ALTER TYPE payment_method ADD VALUE 'debito';
  END IF;
END;
$$;

COMMENT ON TYPE payment_method IS
  'Métodos de pago soportados: efectivo_debito, efectivo_ars, tarjeta_credito, debito, transferencia, mercadopago, cuenta_dni, otro';
