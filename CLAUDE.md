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
- **Entry type** — money / crypto / stocks (soon); decides which assets an entry can use. It is
  derived from the asset (`typeOf` in `src/lib/assets.ts`), not stored.
- **Asset** — anything owned (USD, BTC, later stocks/bonds). All balances show in USD.
- **Drawer** — the right-side panel (`ui/sheet.tsx`) used for every form. Only short "Delete?"
  confirmations stay as small centered pop-ups.

Flow: + card → drawer with a name → empty portfolio shows an "Add entry" empty state → Add entry
asks for the entry type in a dropdown → entry drawer.

`src/lib/entries.ts` is the only module that touches Supabase (portfolios + entries, optimistic
cache). Live prices come from Binance public market data in `src/lib/prices.ts` (REST snapshot +
WebSocket); daily closes for the graph come from `src/lib/history.ts`; balance and graph maths
are in `src/lib/portfolio.ts`.

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
