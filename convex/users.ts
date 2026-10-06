import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { signedIn } from './data'

/** The signed-in user's email and saved language; null when signed out. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    const user = userId && (await ctx.db.get(userId))
    if (!user) return null
    return { email: user.email ?? '', language: user.language }
  },
})

/** Saves the app language on the account, so it follows the user to every device. */
export const setLanguage = mutation({
  args: { language: v.union(v.literal('uk'), v.literal('en')) },
  handler: async (ctx, { language }) => {
    await ctx.db.patch(await signedIn(ctx), { language })
  },
})
