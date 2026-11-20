CREATE TABLE IF NOT EXISTS public.payment_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  usdt_bep20_address TEXT NOT NULL DEFAULT '',
  card_number TEXT NOT NULL DEFAULT '',
  card_holder TEXT NOT NULL DEFAULT '',
  usdt_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  card_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_settings FROM anon, authenticated;
GRANT ALL ON public.payment_settings TO service_role;

INSERT INTO public.payment_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
