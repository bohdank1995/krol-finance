import { useSyncExternalStore } from 'react'
import type { OptimisticLocalStore } from 'convex/browser'
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'
import { ConvexError } from 'convex/values'
import { api } from '../../convex/_generated/api'
import type { AssetSymbol, StockSymbol } from './assets'
import { convex } from './convex'
import { dict } from './i18n'

/* Portfolios (the cards) and their entries (the rows) live in Convex; its server functions
   (`convex/data.ts`) only ever touch the signed-in user's rows. Everything goes through this
   module. The data is a live subscription: changes made elsewhere (another tab, the daily
   Monobank / IBKR syncs) show up on their own. Edits show instantly and are undone if the
   server rejects them. An entry is a change: positive adds to the portfolio, negative takes away. */

export type Portfolio = {
  id: string
  name: string
  createdAt: string
  /** 'monobank' portfolios mirror a Monobank card, 'ibkr' ones stocks at Interactive Brokers:
      their entries are synced, not typed in. */
  source: 'manual' | 'monobank' | 'ibkr'
  /** When a synced portfolio was last synced. */
  syncedAt?: string
  /** Place in the cards row once dragged; unset ones follow in creation order. */
  position?: number
  /** False when the card is hidden from the Net worth total. */
  inNetWorth: boolean
  /** Share of the real balance shown on the card and its graph, 1–100. */
  cardPercent: number
  /** Share of the real balance counted in Net worth, 0–100 (ignored while hidden). */
  netWorthPercent: number
  /** False when left out of the Net worth passive income. */
  inPassiveIncome: boolean
}

export type Entry = {
  id: string
  portfolioId: string
  asset: AssetSymbol
  /** Signed decimal string, kept exactly as typed (normalised to a dot separator). */
  amount: string
  /** ISO timestamp of when the change happened (editable, so it can be backdated). */
  createdAt: string
  /** Optional free-text note. */
  note?: string
  /** Purchases synced from IBKR: USD paid per share. */
  price?: number
}

/** A dividend or interest payment in USD (negative for tax withheld), kept per portfolio. */
export type Payout = { id: string; portfolioId: string; date: string; usd: number }

type Data = NonNullable<FunctionReturnType<typeof api.data.everything>>

const listeners = new Set<() => void>()
let portfoliosCache: Portfolio[] = []
let entriesCache: Entry[] = []
let payoutsCache: Payout[] = []
/** False until the signed-in user's data has come back from the server (shows skeletons). */
let loadedCache = false

function set(portfolios: Portfolio[], entries: Entry[], loaded = true, payouts: Payout[] = []) {
  portfoliosCache = portfolios
  entriesCache = entries
  payoutsCache = payouts
  loadedCache = loaded
  listeners.forEach((l) => l())
}

/** Dragged order first, then the rest (new ones, never-dragged ones) by creation. */
function sortPortfolios(list: Portfolio[]) {
  const rank = (p: Portfolio) => p.position ?? Infinity
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.createdAt < b.createdAt ? -1 : 1))
}

// Follows sign-in and sign-out on its own: the query answers null while signed out.
const watch = convex.watchQuery(api.data.everything, {})
function refresh() {
  let data: Data | null | undefined
  try {
    data = watch.localQueryResult()
  } catch (e) {
    console.error('Could not load data', e)
    return set([], []) // stop the skeletons; the empty state is shown instead
  }
  if (data === undefined) return // still loading
  if (data === null) return set([], [], false)
  set(
    sortPortfolios(data.portfolios as Portfolio[]),
    ([...data.entries] as Entry[]).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    true,
    data.payouts,
  )
}
watch.onUpdate(refresh)
refresh()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const usePortfolios = () => useSyncExternalStore(subscribe, () => portfoliosCache)
export const useEntries = () => useSyncExternalStore(subscribe, () => entriesCache)
export const usePayouts = () => useSyncExternalStore(subscribe, () => payoutsCache)
export const useLoaded = () => useSyncExternalStore(subscribe, () => loadedCache)

/** Saves a change: `preview` shows it right away, and Convex undoes it if the save fails. */
function save<M extends FunctionReference<'mutation'>>(mutation: M, args: FunctionArgs<M>, preview: (d: Data) => Data) {
  convex
    .mutation(mutation, args, {
      optimisticUpdate: (store: OptimisticLocalStore) => {
        const data = store.getQuery(api.data.everything, {})
        if (data) store.setQuery(api.data.everything, {}, preview(data))
      },
    })
    .catch((e) => console.error('Could not save change', e))
}

const patchPortfolio = (id: string, patch: Partial<Portfolio>) => (d: Data) => ({
  ...d,
  portfolios: d.portfolios.map((p) => (p.id === id ? { ...p, ...patch } : p)),
})

type EntryInput = { asset: AssetSymbol; amount: string; createdAt?: string; note?: string }

/** Creates an empty portfolio (entries are added afterwards). Returns its id. */
export function addPortfolio(name: string) {
  const portfolio: Portfolio = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), source: 'manual', inNetWorth: true, cardPercent: 100, netWorthPercent: 100, inPassiveIncome: true }
  save(api.data.addPortfolio, { id: portfolio.id, name, createdAt: portfolio.createdAt }, (d) => ({
    ...d,
    portfolios: [...d.portfolios, portfolio],
  }))
  return portfolio.id
}

export function renamePortfolio(id: string, name: string) {
  save(api.data.updatePortfolio, { id, name }, patchPortfolio(id, { name }))
}

/** Shows or hides a portfolio in the Net worth total. */
export function setInNetWorth(id: string, inNetWorth: boolean) {
  save(api.data.updatePortfolio, { id, inNetWorth }, patchPortfolio(id, { inNetWorth }))
}

/** Counts a portfolio in the Net worth passive income, or leaves it out. */
export function setInPassiveIncome(id: string, inPassiveIncome: boolean) {
  save(api.data.updatePortfolio, { id, inPassiveIncome }, patchPortfolio(id, { inPassiveIncome }))
}

/** Sets how much of a portfolio's real balance its card shows and Net worth counts. */
export function setPercents(id: string, cardPercent: number, netWorthPercent: number) {
  save(api.data.updatePortfolio, { id, cardPercent, netWorthPercent }, patchPortfolio(id, { cardPercent, netWorthPercent }))
}

/** The part of a portfolio a view adds up: 0–1. Hidden portfolios count 0 toward Net worth. */
export const shareOf = (p: Portfolio, view: 'card' | 'netWorth') =>
  view === 'card' ? p.cardPercent / 100 : p.inNetWorth ? p.netWorthPercent / 100 : 0

/** The portfolios Net worth counts (not hidden, not at 0%). */
export const netWorthPortfolios = (portfolios: Portfolio[]) => portfolios.filter((p) => shareOf(p, 'netWorth') > 0)

/** The entries Net worth lists: every portfolio's except the ones counting 0%. */
export function netWorthEntries(portfolios: Portfolio[], entries: Entry[]) {
  const left = new Set(portfolios.filter((p) => !shareOf(p, 'netWorth')).map((p) => p.id))
  return left.size ? entries.filter((e) => !left.has(e.portfolioId)) : entries
}

/** Entries with each amount scaled by its portfolio's share, for totals and the graph only
    (the table keeps real amounts). Portfolios counting 0% are left out. */
export function scaleEntries(portfolios: Portfolio[], entries: Entry[], view: 'card' | 'netWorth') {
  const share = new Map(portfolios.map((p) => [p.id, shareOf(p, view)]))
  return entries.flatMap((e) => {
    const f = share.get(e.portfolioId) ?? 1
    if (f === 1) return [e]
    return f ? [{ ...e, amount: String(Number(e.amount) * f) }] : []
  })
}

/** Payouts counted by a view: scaled by each portfolio's share, portfolios counting 0% left out. */
export function scalePayouts(portfolios: Portfolio[], payouts: Payout[], view: 'card' | 'netWorth') {
  const share = new Map(portfolios.map((p) => [p.id, shareOf(p, view)]))
  return payouts.flatMap((r) => {
    const f = share.get(r.portfolioId) ?? 1
    return f ? [{ ...r, usd: r.usd * f }] : []
  })
}

/** Saves a new card order (`ids` in display order). */
export function reorderPortfolios(ids: string[]) {
  save(api.data.reorderPortfolios, { ids }, (d) => ({
    ...d,
    portfolios: d.portfolios.map((p) => (ids.includes(p.id) ? { ...p, position: ids.indexOf(p.id) } : p)),
  }))
}

/** Deleting a portfolio also deletes its entries. */
export function deletePortfolio(id: string) {
  save(api.data.deletePortfolio, { id }, (d) => ({
    portfolios: d.portfolios.filter((p) => p.id !== id),
    entries: d.entries.filter((e) => e.portfolioId !== id),
    payouts: d.payouts.filter((r) => r.portfolioId !== id),
  }))
}

export function addEntry(portfolioId: string, input: EntryInput) {
  const entry: Entry = {
    id: crypto.randomUUID(),
    portfolioId,
    asset: input.asset,
    amount: input.amount,
    createdAt: input.createdAt ?? new Date().toISOString(),
    note: input.note,
  }
  save(api.data.addEntry, entry, (d) => ({ ...d, entries: [entry, ...d.entries] }))
}

export function updateEntry(id: string, patch: Omit<Entry, 'id'>) {
  const entry = { id, ...patch }
  save(api.data.updateEntry, entry, (d) => ({ ...d, entries: d.entries.map((e) => (e.id === id ? entry : e)) }))
}

export function deleteEntry(id: string) {
  save(api.data.deleteEntry, { id }, (d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }))
}

/** Synced portfolios (Monobank, IBKR) can't have entries added, edited or deleted by hand. */
export const isReadOnly = (p: Portfolio | undefined) => !!p && p.source !== 'manual'

/** Runs a server action; a message it gives (ConvexError) becomes the thrown message. */
export async function call<A extends FunctionReference<'action'>>(
  fn: A,
  args: FunctionArgs<A>,
  fallback: string,
): Promise<FunctionReturnType<A>> {
  try {
    return await convex.action(fn, args)
  } catch (e) {
    throw new Error(e instanceof ConvexError && typeof e.data === 'string' ? e.data : fallback)
  }
}

/* Monobank: the token goes to the `monobank` server functions, which keep it server-side, talk
   to Monobank and write the portfolio + entries (they then arrive through the live data). */

export type MonobankCard = {
  id: string
  /** Card kind: black, white, iron, platinum, fop, yellow, eAid… */
  type: string
  last4: string
  /** null when the card's currency can't be priced yet. */
  asset: AssetSymbol | null
  /** Available to spend (includes the credit limit), as a decimal string. */
  balance: string
  connected: boolean
}

/** Lists the cards Monobank shows. Pass the token the first time; after that leave it out and the
    server uses the kept one (null means no token is kept yet). */
export async function listMonobankCards(token?: string) {
  return (await call(api.monobank.cards, { token }, dict().monobank.unreachable)) as MonobankCard[] | null
}

/** Creates a portfolio for the card with its last 31 days of transactions. Returns its id. */
export function connectMonobankCard(accountId: string, name: string) {
  return call(api.monobank.connect, { accountId, name }, dict().monobank.unreachable)
}

/* Interactive Brokers: the Flex token + Query ID go to the `ibkr` server functions, which keep them
   server-side, read the account's stocks and write the portfolio + entries. */

export type IbkrPosition = {
  asset: StockSymbol
  /** IBKR's ticker, e.g. "AAPL" or "BRK B". */
  symbol: string
  /** Company or fund name. */
  name: string
  /** Shares held, as a decimal string. */
  quantity: string
  /** Current value in USD; null when the stock can't be priced (it can't be connected then). */
  value: number | null
  connected: boolean
}

/** Runs the Flex Query and lists the stocks in the account. Pass the token + Query ID the first time;
    after that leave them out and the server uses the kept ones (null means none are kept yet). */
export async function listIbkrPositions(token?: string, queryId?: string) {
  return (await call(api.ibkr.positions, { token, queryId }, dict().ibkr.unreachable)) as IbkrPosition[] | null
}

/** Creates a portfolio with the picked stocks (`all`: every stock, also ones bought later). Returns its id. */
export function connectIbkr(name: string, assets: StockSymbol[], all: boolean) {
  return call(api.ibkr.connect, { name, assets, all }, dict().ibkr.unreachable)
}

/** Removes a stock and all its rows from an IBKR portfolio; later syncs leave it out. */
export function removeStock(portfolioId: string, asset: StockSymbol) {
  save(api.ibkr.removeStock, { portfolioId, asset }, (d) => ({
    ...d,
    entries: d.entries.filter((e) => e.portfolioId !== portfolioId || e.asset !== asset),
  }))
}

/** "Sync now" for Interactive Brokers: adds a new row for every stock whose share count changed. Returns how many rows were added. */
export function refreshIbkr() {
  return call(api.ibkr.refresh, {}, dict().ibkr.unreachable)
}
