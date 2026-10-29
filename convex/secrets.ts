import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalMutation, internalQuery } from './_generated/server'

/* Monobank and IBKR tokens are stored encrypted (AES-GCM), with the key in the deployment's
   TOKEN_KEY environment variable (32 random bytes, base64: `openssl rand -base64 32`). Someone
   who sees the database or a backup, but not the environment, can't use them.

   Only actions encrypt and decrypt: they `seal` a token before saving it and `open` it after
   reading. A value without the `v1:` prefix is a token saved before encryption and is used as is. */

const PREFIX = 'v1:'

const bytes = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
const base64 = (data: Uint8Array) => btoa(String.fromCharCode(...data))

async function key() {
  const raw = process.env.TOKEN_KEY
  if (!raw) throw new Error('TOKEN_KEY is not set on this deployment (see convex/README.md).')
  return crypto.subtle.importKey('raw', bytes(raw), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function seal(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(token))
  return `${PREFIX}${base64(iv)}:${base64(new Uint8Array(data))}`
}

export async function open(stored: string) {
  if (!stored.startsWith(PREFIX)) return stored
  const [iv, data] = stored.slice(PREFIX.length).split(':')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, await key(), bytes(data))
  return new TextDecoder().decode(plain)
}

/* ---------- One-time: encrypt tokens saved before encryption ----------
   npx convex run secrets:encryptAll (add --prod for production). Safe to run again. */

export const encryptAll = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    const rows: { table: 'monobankTokens' | 'ibkrTokens'; id: string; token: string }[] = await ctx.runQuery(
      internal.secrets.plain,
    )
    for (const row of rows) await ctx.runMutation(internal.secrets.replace, { ...row, token: await seal(row.token) })
    return rows.length
  },
})

export const plain = internalQuery({
  args: {},
  handler: async (ctx) => {
    const mono = await ctx.db.query('monobankTokens').collect()
    const ibkr = await ctx.db.query('ibkrTokens').collect()
    return [
      ...mono.map((r) => ({ table: 'monobankTokens' as const, id: r._id as string, token: r.token })),
      ...ibkr.map((r) => ({ table: 'ibkrTokens' as const, id: r._id as string, token: r.token })),
    ].filter((r) => !r.token.startsWith(PREFIX))
  },
})

export const replace = internalMutation({
  args: { table: v.union(v.literal('monobankTokens'), v.literal('ibkrTokens')), id: v.string(), token: v.string() },
  handler: async (ctx, { table, id, token }) => {
    const docId = ctx.db.normalizeId(table, id)
    if (docId) await ctx.db.patch(docId, { token })
  },
})
