import { ConvexReactClient } from 'convex/react'

const url = import.meta.env.VITE_CONVEX_URL

if (!url) {
  throw new Error('Missing Convex settings. Run `npx convex dev` once: it writes VITE_CONVEX_URL to .env.local.')
}

/** The one connection to the Convex backend (data, sign-in, server functions). */
export const convex = new ConvexReactClient(url)
