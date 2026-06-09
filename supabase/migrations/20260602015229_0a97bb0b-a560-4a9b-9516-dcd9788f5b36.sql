ALTER TABLE public.users ADD COLUMN IF NOT EXISTS delete_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_users_delete_at ON public.users (delete_at) WHERE delete_at IS NOT NULL;