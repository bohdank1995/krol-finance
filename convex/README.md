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

## 3. Token encryption key

Monobank and IBKR tokens are stored encrypted (`secrets.ts`). Each deployment needs its own key:

    npx convex env set TOKEN_KEY "$(openssl rand -base64 32)"

(and again with `--prod`). Never change or remove it once tokens are saved: they couldn't be read
any more and every user would have to paste theirs again. Tokens saved before encryption are
encrypted by `npx convex run secrets:encryptAll` (safe to repeat).

## Production

`npx convex deploy` pushes to the production deployment, which has its own data and environment
variables (repeat step 2 there with `--prod`). Builds use `VITE_CONVEX_URL` of that deployment.

Vercel does this on every push to `main` (`vercel.json`): its production build runs
`npx convex deploy --cmd 'npm run build'`, so the functions and the app ship together. It needs a
production deploy key (Convex dashboard → Settings → Deploy keys) saved in Vercel as
`CONVEX_DEPLOY_KEY`, Production only. Preview builds only build the app.

## Syncs

`crons.ts` runs the Monobank sync at :07 and the IBKR sync at :37 every hour. Runs and their logs
are in the Convex dashboard (`npx convex dashboard`) → Logs / Schedules.
