-- Replace notify_push_on_notification() to include the notification `type`
-- in the edge function payload. Required so the edge function can apply
-- per-type suppression (e.g. territory alerts toggle).

CREATE OR REPLACE FUNCTION public.notify_push_on_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  edge_url text;
BEGIN
  edge_url := current_setting('app.edge_function_url', true);
  IF edge_url IS NULL OR edge_url = '' THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url     := edge_url || '/send-push-notification',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
               ),
    body    := jsonb_build_object(
                 'user_id',    NEW.user_id,
                 'title',      NEW.title,
                 'body',       COALESCE(NEW.body, ''),
                 'action_url', COALESCE(NEW.action_url, '/'),
                 'type',       NEW.type
               )::text
  );
  RETURN NEW;
END;
$$;
