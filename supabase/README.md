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

## Interactive Brokers + stock prices

`functions/ibkr` is an Edge Function: it keeps IBKR Flex Web Service tokens server-side, reads the
account's stocks from a Flex Query when connecting, refreshes share counts once a day (hourly cron
run, one stale user per run), and serves live stock prices and daily closes from Yahoo Finance.

Run `migrations/0008_ibkr.sql` in the SQL Editor, then deploy:

    npx supabase functions deploy ibkr --no-verify-jwt

It reuses the `CRON_SECRET` function secret and the two Vault secrets set up for Monobank.
