# Convex setup

The backend: database, sign-in, the Monobank / IBKR server functions and their hourly syncs.
Functions deploy straight from this folder. `npx convex dev` watches it and pushes every save to
your dev deployment, and also regenerates `_generated/`.

## 1. Connect your Convex account (once)

    npx convex dev

It opens the browser to log in and asks for a project (create one, e.g. `krol-finance`). It then
writes `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` to `.env.local`. Keep it
running while you work, next to `npm run dev`.

## 2. Sign-in keys

    npx @convex-dev/auth --web-server-url http://localhost:5173

Sets `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL` on the deployment (the files it offers to create here
already exist, so skip those). `SITE_URL` is where sign-in returns to; change it when the app is hosted.

**Google**: in Google Cloud Console → APIs & Services → Credentials, edit the OAuth client
used before (or create a "Web application" one). Add the authorised redirect URI
`<VITE_CONVEX_SITE_URL from .env.local>/api/auth/callback/google`, then:

    npx convex env set AUTH_GOOGLE_ID <client id>
    npx convex env set AUTH_GOOGLE_SECRET <client secret>

## 3. Copy the data from Supabase (once)

1. Open the app and sign in once (this creates your Convex user).
2. Copy the Project URL and the **secret** key (`sb_secret_…`, or the legacy `service_role` key)
   from Supabase → Project Settings → API Keys, and run:

        npx convex env set SUPABASE_URL https://<ref>.supabase.co
        npx convex env set SUPABASE_SERVICE_ROLE_KEY <secret key>
        npx convex run migrate:fromSupabase '{"email":"<your Google email>"}'

   Portfolios, entries, percentages, card order and the Monobank / IBKR connections all come over.
   Running it twice is safe: rows already copied are skipped.
3. Remove the secret again:

        npx convex env remove SUPABASE_SERVICE_ROLE_KEY
        npx convex env remove SUPABASE_URL

## Production

`npx convex deploy` pushes to the production deployment, which has its own data and environment
variables (repeat step 2 there with `--prod`). Builds use `VITE_CONVEX_URL` of that deployment.

## Syncs

`crons.ts` runs the Monobank sync at :07 and the IBKR sync at :37 every hour. Runs and their logs
are in the Convex dashboard (`npx convex dashboard`) → Logs / Schedules.
