import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { signedIn } from './data'

/** The signed-in user's id (scrambled for analytics), email, saved language and period, and account age; null when signed out. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    const user = userId && (await ctx.db.get(userId))
    if (!user) return null
    return {
      id: user._id,
      email: user.email ?? '',
      language: user.language,
      period: user.period,
      image: user.image,
      createdAt: user._creationTime,
    }
  },
})

/** Saves the app language on the account, so it follows the user to every device. */
export const setLanguage = mutation({
  args: { language: v.union(v.literal('uk'), v.literal('en')) },
  handler: async (ctx, { language }) => {
    await ctx.db.patch(await signedIn(ctx), { language })
  },
})

/** Saves the last picked period, so the dashboard opens on it next time. The app falls back to
    All time for a name it doesn't know. */
export const setPeriod = mutation({
  args: {
    period: v.union(
      v.string(),
      v.object({
        last: v.number(),
        unit: v.union(v.literal('days'), v.literal('weeks'), v.literal('months'), v.literal('years')),
      }),
    ),
  },
  handler: async (ctx, { period }) => {
    const userId = await signedIn(ctx)
    if (typeof period === 'string' ? !/^[a-z0-9-]{1,30}$/.test(period) : !(Number.isInteger(period.last) && period.last >= 1 && period.last <= 999))
      throw new ConvexError('Unknown period.')
    await ctx.db.patch(userId, { period })
  },
})
