import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

/* Every table holds one user's personal finances: each function checks `userId` against the
   signed-in user itself (Convex has no Row Level Security; `convex/data.ts` is the gate).
   Portfolios and entries keep an app-made UUID in `id`, so the app can show a new row before
   the server has saved it (and rows copied from Supabase keep their old ids). */

export const source = v.union(v.literal('manual'), v.literal('monobank'), v.literal('ibkr'))

export default defineSchema({
  ...authTables,
  // Convex Auth's users table, plus the app language (`uk` / `en`).
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    language: v.optional(v.string()),
  })
    .index('email', ['email'])
    .index('phone', ['phone']),

  portfolios: defineTable({
    id: v.string(),
    userId: v.id('users'),
    name: v.string(),
    /** ISO timestamp. */
    createdAt: v.string(),
    /** 'monobank' portfolios mirror a Monobank card, 'ibkr' ones stocks at Interactive Brokers. */
    source,
    /** The Monobank account id of a 'monobank' portfolio. */
    externalAccountId: v.optional(v.string()),
    /** When a synced portfolio was last synced (ms). */
    syncedAt: v.optional(v.number()),
    /** Place in the cards row once dragged. */
    position: v.optional(v.number()),
    inNetWorth: v.boolean(),
    /** 1–100: share of the real balance shown on the card and its graph. */
    cardPercent: v.number(),
    /** 0–100: share of the real balance counted in Net worth. */
    netWorthPercent: v.number(),
    /** False when left out of the Net worth passive income (unset = counted). */
    inPassiveIncome: v.optional(v.boolean()),
    /** IBKR: the followed stocks; null = every stock, also ones bought later ("Select all"). */
    trackedAssets: v.optional(v.union(v.array(v.string()), v.null())),
    /** IBKR: stocks removed by hand; syncs never add them back. */
    removedAssets: v.optional(v.array(v.string())),
    /** IBKR: true once the real purchase history (Trades) has replaced the placeholder opening positions. Older; see tradesVersion. */
    history: v.optional(v.boolean()),
    /** IBKR: which version of the trade import this portfolio has (see TRADES_VERSION in ibkr.ts). */
    tradesVersion: v.optional(v.number()),
  })
    .index('by_app_id', ['id'])
    .index('by_user', ['userId'])
    .index('by_user_source', ['userId', 'source'])
    // Unsynced (no syncedAt) sort first, then the stalest: what the daily syncs pick up.
    .index('by_source_synced', ['source', 'syncedAt']),

  entries: defineTable({
    id: v.string(),
    userId: v.id('users'),
    /** The portfolio's app `id`. */
    portfolioId: v.string(),
    asset: v.string(),
    /** Signed decimal string, kept exact. */
    amount: v.string(),
    /** ISO timestamp of when the change happened. */
    createdAt: v.string(),
    note: v.optional(v.string()),
    /** Purchases from IBKR trades: USD paid per share, so passive income counts the move since buying. */
    price: v.optional(v.number()),
    /** Synced entries: the Monobank transaction id etc., so a sync never adds one twice. */
    externalId: v.optional(v.string()),
  })
    .index('by_app_id', ['id'])
    .index('by_user', ['userId'])
    .index('by_portfolio_external', ['portfolioId', 'externalId']),

  // Dividends and interest from IBKR, one row per IBKR portfolio holding the stock (USD).
  payouts: defineTable({
    userId: v.id('users'),
    /** The portfolio's app `id`. */
    portfolioId: v.string(),
    asset: v.optional(v.string()),
    /** "YYYY-MM-DD" (UTC). */
    date: v.string(),
    /** Signed USD amount: dividends and interest are positive, withheld tax negative. */
    usd: v.number(),
    kind: v.string(),
    /** IBKR transaction id + portfolio, so a sync never adds one twice. */
    externalId: v.string(),
  })
    .index('by_user', ['userId'])
    .index('by_portfolio_external', ['portfolioId', 'externalId']),

  // Server-only secrets: no public function ever returns these.
  monobankTokens: defineTable({
    userId: v.id('users'),
    token: v.string(),
    /** The card list from the last check, so connecting needs no extra Monobank call. */
    accounts: v.any(),
    /** Secret part of the webhook address Monobank posts new transactions to. */
    webhookSecret: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_webhook_secret', ['webhookSecret']),

  ibkrTokens: defineTable({
    userId: v.id('users'),
    token: v.string(),
    queryId: v.string(),
    /** The stock list from the last check, so connecting needs no extra IBKR call. */
    positions: v.any(),
  }).index('by_user', ['userId']),
})
