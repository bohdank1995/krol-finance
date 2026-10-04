# claude-design-experiment

Personal finance tracker: manual entries plus imported Interactive Brokers (IBKR)
statements.

React 19 + TypeScript + Tailwind 4 on Vite. `npm run dev` (port 5173),
`npm run build`, `npm run lint` (oxlint).

## UI

shadcn/ui (style `base-nova`, Base UI primitives, neutral base color, lucide icons),
configured in `components.json`. Add components with `npx shadcn@latest add <name>`;
they land in `src/components/ui/`. Import via the `@/` alias (`@/components/ui/button`).

Theme lives as CSS variables in `src/index.css`. Don't hardcode colors in app code —
use the theme tokens (`bg-primary`, `text-muted-foreground`, …).

The user is a designer, not an engineer. Explain changes in plain language.

## Data

Vocabulary:
- **Portfolio** — a named card in the top "Portfolios" row (e.g. "Binance"): a name plus its entries,
  no type of its own. The first card, **Net worth**, sums every portfolio.
- **Entry** — a signed change (+/−) of one asset inside a portfolio. One portfolio can mix entry types.
- **Entry type** — money / crypto / stocks; decides which assets an entry can use. It is
  derived from the asset (`typeOf` in `src/lib/assets.ts`), not stored. Manual stock entries are "soon".
- **Asset** — anything owned (USD, BTC, stocks). A stock is stored as `stock:<Yahoo ticker>`
  (`stock:AAPL`, `stock:VWCE.DE`) and shown as "AAPL" (`assetLabel`). All balances show in USD.
- **Monobank portfolio** — a portfolio with `source = 'monobank'`, mirroring one Monobank card. Its
  entries are the card's transactions (plus "Opening balance" / "Balance adjustment" rows) and are
  read-only in the app and in RLS. Balance = available to spend (includes any credit limit).
- **IBKR portfolio** — `source = 'ibkr'`, stocks held at Interactive Brokers. Entries are share counts:
  one "Opening position" per stock, then "Position change" rows from the daily sync. Read-only like
  Monobank. `tracked_assets` lists the picked stocks; null ("Select all") also follows new purchases.
- **Period** — the tracked time span picked in the header (All time by default, not saved). It limits
  the graph and table; cards show the balance at the period's end plus the change during it.
- **Display currency** — USD / EUR / UAH switch in the header; values convert via the currency's own
  Binance price. Saved per browser in `src/lib/preferences.ts`.
- **Fake numbers** — toggle in the user menu: every portfolio's entries are scaled by a random
  factor (`src/lib/fake.ts`) and the app becomes read-only, so screenshots are safe to share.
- **Card order** — portfolio cards are dragged into order (@dnd-kit), saved in `portfolios.position`.
- **Drawer** — the right-side panel (`ui/sheet.tsx`) used for every form. Only short "Delete?"
  confirmations stay as small centered pop-ups.

Flow: + card → drawer with a name → floating Deposit (+, primary) / Withdraw (−, secondary) buttons →
each asks for the entry type in a dropdown → entry drawer (the button decides the sign).

The + card opens a menu: Custom (the flow above), Monobank (`monobank-drawer.tsx`: paste token → pick card)
or Interactive Brokers (`ibkr-drawer.tsx`: setup guide → paste Flex token + Query ID → pick stocks / Select all).

`src/lib/entries.ts` is the only module that touches Supabase (portfolios + entries, optimistic
cache, `invoke` for Edge Functions). Live prices come from Binance public market data in
`src/lib/prices.ts` (REST snapshot + WebSocket); stock prices come from Yahoo Finance through the
`ibkr` Edge Function, polled every 30 s (`src/lib/stocks.ts`) and merged in. Daily closes for the
graph come from `src/lib/history.ts`; balance and graph maths are in `src/lib/portfolio.ts`.

## Design

Dark only, cold (neutrals carry a faint blue hue), Supabase-like: deep green CTA with a
bright green edge, green reserved for actions and the live dot. Numbers always use the
mono font (`font-mono tabular-nums`). Labels only where genuinely needed — single user.
Theme tokens are in `src/index.css`; `--brand` is the bright green, `--faint-foreground`
the dimmest text.

## Database

Target: Supabase (hosted Postgres), not wired to the UI yet. Client is `src/lib/supabase.ts`; settings come from
`.env.local` (git-ignored; template in `.env.example`). The publishable key is public by
design — every table must have Row Level Security enabled with policies scoped to the
signed-in user, since this holds personal financial data.

Monobank: the `monobank` Edge Function (`supabase/functions/monobank`) keeps tokens server-side in
`monobank_tokens` (RLS on, no policies), imports a card's last 31 days on connect, and an hourly
pg_cron job syncs the stalest card (each card ≈ daily; Monobank allows 1 request/min). Setup and
deploy steps: `supabase/README.md`. CLI runs via `npx supabase`.

IBKR: the `ibkr` Edge Function (`supabase/functions/ibkr`) keeps the Flex Web Service token + Query ID in
`ibkr_tokens` (RLS on, no policies), reads Open Positions from the Flex report (as of the last business
day), and an hourly pg_cron job syncs the stalest user's IBKR cards (≈ daily). It also serves stock
quotes and daily history (Yahoo Finance) to signed-in users.
