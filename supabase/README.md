# Supabase setup

Migrations in `migrations/` are run once each, in order, in Supabase → SQL Editor.

## Monobank sync

`functions/monobank` is an Edge Function: it keeps Monobank tokens server-side, imports a card's
last 31 days when connected, and refreshes one stale card per hourly cron run (each card ≈ daily).

Deploy (after `npx supabase login` and `npx supabase link --project-ref <ref>`):

    npx supabase functions deploy monobank --no-verify-jwt
    npx supabase secrets set CRON_SECRET=<random string>

`--no-verify-jwt` because the cron call has no user login; the function checks the user itself
(or the `x-cron-secret` header for `sync`).

The cron job in `0006_monobank.sql` reads two Vault secrets. Add them once in the SQL Editor
(not committed — use the same random string as CRON_SECRET):

    select vault.create_secret('https://<ref>.supabase.co', 'project_url');
    select vault.create_secret('<random string>', 'monobank_cron_secret');

Check runs with `select * from cron.job_run_details order by start_time desc limit 5;`.
