-- Add native network-token payment methods (BNB, SOL, POL) to existing Loti Premium database.
ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS bnb_address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sol_address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pol_address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bnb_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sol_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pol_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_payment_method_check,
  DROP CONSTRAINT IF EXISTS payment_orders_network_check,
  DROP CONSTRAINT IF EXISTS payment_orders_method_network_check;

ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_payment_method_check
    CHECK (payment_method IN ('usdt', 'bnb', 'sol', 'pol', 'card')),
  ADD CONSTRAINT payment_orders_network_check
    CHECK (network IS NULL OR network IN ('bep20', 'solana', 'polygon')),
  ADD CONSTRAINT payment_orders_method_network_check
    CHECK (
      (payment_method = 'usdt' AND network IS NOT NULL) OR
      (payment_method IN ('bnb', 'sol', 'pol', 'card') AND network IS NULL)
    );
