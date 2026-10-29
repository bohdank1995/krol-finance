import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalMutation } from './_generated/server'

/* "Delete account": removes the signed-in user and everything they own — portfolios, entries,
   payouts, Monobank / IBKR tokens, rate-limit counters and their sign-in records. Big accounts
   (years of Monobank transactions) are deleted in batches, one transaction each. */

const BATCH = 1000

export const deleteAccount = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Please sign in again.')
    for (;;) {
      const done: boolean = await ctx.runMutation(internal.account.wipe, { userId })
      if (done) return null
    }
  },
})

/** Deletes up to BATCH of the user's rows; true once nothing is left, the user row included. */
export const wipe = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    let left = BATCH
    for (const table of ['entries', 'payouts', 'portfolios', 'monobankTokens', 'ibkrTokens'] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(left)
      for (const r of rows) await ctx.db.delete(r._id)
      left -= rows.length
      if (left === 0) return false
    }
    for (const r of await ctx.db
      .query('rateLimits')
      .withIndex('by_user_kind', (q) => q.eq('userId', userId))
      .collect())
      await ctx.db.delete(r._id)

    // Sign-in records last, so a half-finished delete can be retried while still signed in.
    for (const session of await ctx.db
      .query('authSessions')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .collect()) {
      for (const t of await ctx.db
        .query('authRefreshTokens')
        .withIndex('sessionId', (q) => q.eq('sessionId', session._id))
        .collect())
        await ctx.db.delete(t._id)
      await ctx.db.delete(session._id)
    }
    for (const a of await ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (q) => q.eq('userId', userId))
      .collect())
      await ctx.db.delete(a._id)
    if (await ctx.db.get(userId)) await ctx.db.delete(userId)
    return true
  },
})
