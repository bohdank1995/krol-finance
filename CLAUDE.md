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
  read-only in the app and on the server. Balance = available to spend (includes any credit limit).
- **IBKR portfolio** — `source = 'ibkr'`, stocks held at Interactive Brokers. Entries are share counts:
  one "Opening position" per stock, then "Position change" rows from the daily sync. Read-only like
  Monobank. `trackedAssets` lists the picked stocks; null ("Select all") also follows new purchases.
- **Period** — the tracked time span picked above the cards, on the left (All time by default, not saved). It limits
  the graph and table; cards show the balance at the period's end plus the change during it.
- **Display currency** — USD / EUR / UAH switch in the user popover; values convert via the currency's own
  Binance price. Saved per browser in `src/lib/preferences.ts`.
- **Language** — Ukrainian (default) / English switch in the user popover. Texts live in `src/lib/i18n.ts`
  (`useT()`); the choice is saved on the account (`language` on the Convex user). The sign-in page stays English.
- **Fake numbers** — toggle in the user menu: every portfolio's entries are scaled by a random
  factor (`src/lib/fake.ts`) and the app becomes read-only, so screenshots are safe to share.
- **Hidden from net worth** — a portfolio's ⋯ menu can leave it out of Net worth (card, graph and table);
  saved in `portfolios.inNetWorth`, its own card is unchanged.
- **Percentages** — per portfolio (⋯ → Set percentages): `cardPercent` (what the card + its graph show,
  with a "50% of …" line) and `netWorthPercent` (what Net worth counts). Totals and graphs use
  `scaleEntries`; the table and stored entries keep real amounts.
- **Card order** — portfolio cards are dragged into order (@dnd-kit), saved in `portfolios.position`.
- **Drawer** — the right-side panel (`ui/sheet.tsx`) used for every form. Only short "Delete?"
  confirmations stay as small centered pop-ups.

Flow: + card → drawer with a name → floating Deposit (+, primary) / Withdraw (−, secondary) buttons →
each asks for the entry type in a dropdown → entry drawer (the button decides the sign).

The + card opens a menu: Custom (the flow above), Monobank (`monobank-drawer.tsx`: paste token → pick card)
or Interactive Brokers (`ibkr-drawer.tsx`: setup guide → paste Flex token + Query ID → pick stocks / Select all).

`src/lib/entries.ts` is the app's data module (live Convex subscription to portfolios + entries,
optimistic edits, `call` for server actions). Live prices come from Binance public market data in
`src/lib/prices.ts` (REST snapshot + WebSocket); stock prices come from Yahoo Finance through the
`ibkr` Convex actions, polled every 30 s (`src/lib/stocks.ts`) and merged in. Daily closes for the
graph come from `src/lib/history.ts`; balance and graph maths are in `src/lib/portfolio.ts`.

## Design

Dark only, cold (neutrals carry a faint blue hue), Supabase-like: deep green CTA with a
bright green edge, green reserved for actions and the live dot. Numbers always use the
mono font (`font-mono tabular-nums`). Labels only where genuinely needed — single user.
Theme tokens are in `src/index.css`; `--brand` is the bright green, `--faint-foreground`
the dimmest text.

## Database

Convex (`convex/`), set up as in `convex/README.md`. Run `npx convex dev` next to `npm run dev`:
it pushes `convex/` on every save and keeps `convex/_generated/` up to date (committed). The app's
client is `src/lib/convex.ts` (`VITE_CONVEX_URL` in `.env.local`). Sign-in is Convex Auth
(`convex/auth.ts`): Google only for now.

Convex has no Row Level Security: every public function checks the signed-in user itself
(`convex/data.ts`, `signedIn` / `ownPortfolio`), since this holds personal financial data. Portfolios
and entries carry an app-made UUID in `id` (the app creates rows before the server answers);
entries point to their portfolio by that `id`. Tokens live in `monobankTokens` / `ibkrTokens`,
read only by internal functions.

Monobank (`convex/monobank.ts`): `cards` checks a token and lists cards, `connect` imports a card's
last 31 days, and an hourly cron (`convex/crons.ts`) syncs the stalest card (each card ≈ daily;
Monobank allows 1 request/min).

IBKR (`convex/ibkr.ts`): keeps the Flex Web Service token + Query ID, reads Open Positions from
the Flex report (as of the last business day), and an hourly cron syncs the stalest user's IBKR
cards (≈ daily). It also serves stock quotes and daily history (Yahoo Finance) to signed-in users.

`convex/migrate.ts` is the one-time copy from the old Supabase project.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
