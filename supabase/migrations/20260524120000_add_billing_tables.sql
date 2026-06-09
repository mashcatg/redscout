CREATE TABLE IF NOT EXISTS public.billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  dodo_customer_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dodo_subscription_id TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.billing_customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  plan plan_type NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  keywords_limit INTEGER NOT NULL,
  competitors_limit INTEGER NOT NULL,
  projects_limit INTEGER NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dodo_payment_id TEXT NOT NULL UNIQUE,
  subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.billing_customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  invoice_id TEXT,
  amount_cents INTEGER,
  currency TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_customers_user_id ON public.billing_customers (user_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_customer_id ON public.billing_subscriptions (customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_id ON public.billing_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_customer_id ON public.billing_payments (customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_subscription_id ON public.billing_payments (subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_user_id ON public.billing_payments (user_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.proname = 'update_updated_at_column' AND n.nspname = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_billing_customers_updated') THEN
      CREATE TRIGGER trg_billing_customers_updated
      BEFORE UPDATE ON public.billing_customers
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_billing_subscriptions_updated') THEN
      CREATE TRIGGER trg_billing_subscriptions_updated
      BEFORE UPDATE ON public.billing_subscriptions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_billing_payments_updated') THEN
      CREATE TRIGGER trg_billing_payments_updated
      BEFORE UPDATE ON public.billing_payments
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
  END IF;
END $$;

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_customers_self_select ON public.billing_customers;
CREATE POLICY billing_customers_self_select ON public.billing_customers
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS billing_subscriptions_self_select ON public.billing_subscriptions;
CREATE POLICY billing_subscriptions_self_select ON public.billing_subscriptions
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS billing_payments_self_select ON public.billing_payments;
CREATE POLICY billing_payments_self_select ON public.billing_payments
FOR SELECT USING (user_id = auth.uid());
