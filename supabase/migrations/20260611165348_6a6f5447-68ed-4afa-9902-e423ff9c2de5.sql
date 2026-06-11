ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS mp_preapproval_id text;
CREATE INDEX IF NOT EXISTS subscriptions_mp_preapproval_id_idx ON public.subscriptions(mp_preapproval_id);