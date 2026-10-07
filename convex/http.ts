import { httpRouter } from 'convex/server'
import { internal } from './_generated/api'
import { httpAction } from './_generated/server'
import { auth } from './auth'

const http = httpRouter()
// Sign-in callbacks (Google) and the keys the app checks sessions against.
auth.addHttpRoutes(http)

/* Monobank posts every new card transaction here, at /monobank/webhook/<secret>. The secret is
   the only credential, so it is checked against the stored one and nothing is revealed on a miss. */
const secretOf = (req: Request) => new URL(req.url).pathname.split('/').pop() ?? ''

http.route({
  pathPrefix: '/monobank/webhook/',
  method: 'GET', // Monobank checks the address works when it is registered.
  handler: httpAction(async () => new Response('ok')),
})

http.route({
  pathPrefix: '/monobank/webhook/',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const body: unknown = await req.json().catch(() => null)
    const data = (body as { type?: unknown; data?: { account?: unknown; statementItem?: unknown } } | null)?.data
    if ((body as { type?: unknown } | null)?.type === 'StatementItem' && typeof data?.account === 'string' && data.statementItem)
      await ctx.runMutation(internal.monobank.receive, {
        secret: secretOf(req),
        accountId: data.account,
        item: data.statementItem,
      })
    return new Response('ok') // always 200, so Monobank does not retry or switch the webhook off
  }),
})

export default http
