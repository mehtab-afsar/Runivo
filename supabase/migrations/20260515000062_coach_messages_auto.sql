ALTER TABLE public.coach_messages
  ADD COLUMN IF NOT EXISTS auto_triggered BOOLEAN NOT NULL DEFAULT false;
