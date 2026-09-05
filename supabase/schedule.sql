-- Run after deploying functions. Set Vault secrets compa_functions_url and compa_cron_secret first.
-- URL example: https://PROJECT.supabase.co/functions/v1/reminders
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('compa-reminders','*/5 * * * *',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='compa_functions_url'),
  headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='compa_cron_secret'),'Content-Type','application/json'),
  body:='{}'::jsonb,timeout_milliseconds:=60000
 );
$job$);
