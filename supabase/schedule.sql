-- Run after deploying functions. Set Vault secrets compa_functions_url and compa_cron_secret first.
-- URL example: https://PROJECT.supabase.co/functions/v1/reminders
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Safe to re-run after changing the endpoint or rotating the secret.
select cron.unschedule(jobid)
from cron.job
where jobname in ('compa-reminders', 'compa-chat-retention');

select cron.schedule('compa-reminders','*/5 * * * *',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='compa_functions_url'),
  headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='compa_cron_secret'),'Content-Type','application/json'),
  body:='{}'::jsonb,timeout_milliseconds:=60000
 );
$job$);

-- Chat history has a 30-day retention period and does not require an HTTP secret.
select cron.schedule(
  'compa-chat-retention',
  '15 3 * * *',
  $job$select public.purge_chat_history();$job$
);
