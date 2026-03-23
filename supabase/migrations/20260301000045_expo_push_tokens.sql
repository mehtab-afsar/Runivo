-- expo_push_tokens: stores Expo push tokens for native iOS/Android devices.
-- The existing push_subscriptions table stores VAPID (web) subscriptions.
-- Both tables are fanned out by the send-push-notification edge function.

CREATE TABLE IF NOT EXISTS public.expo_push_tokens (
  id         BIGSERIAL    PRIMARY KEY,
  user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT         NOT NULL,           -- ExponentPushToken[xxx...]
  platform   TEXT         NOT NULL DEFAULT '', -- 'ios' | 'android'
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT expo_push_tokens_user_token_key UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_expo_push_tokens_user ON public.expo_push_tokens(user_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.set_expo_push_token_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expo_push_tokens_updated ON public.expo_push_tokens;
CREATE TRIGGER trg_expo_push_tokens_updated
  BEFORE UPDATE ON public.expo_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_expo_push_token_updated_at();

-- RLS: users may only manage their own tokens
ALTER TABLE public.expo_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own Expo push tokens"
  ON public.expo_push_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can read all tokens (for edge function fan-out)
CREATE POLICY "Service role can read all Expo push tokens"
  ON public.expo_push_tokens
  FOR SELECT
  TO service_role
  USING (true);
