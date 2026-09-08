-- This part of the production schedule can be installed before HTTP secrets exist.
create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'compa-chat-retention';

select cron.schedule(
  'compa-chat-retention',
  '15 3 * * *',
  $job$select public.purge_chat_history();$job$
);
