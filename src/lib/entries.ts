import { useSyncExternalStore } from 'react'
import type { OptimisticLocalStore } from 'convex/browser'
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'
import { ConvexError } from 'convex/values'
import { api } from '../../convex/_generated/api'
import { typeOf, type AssetSymbol, type StockSymbol } from './assets'
import type { Period } from './period'
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
  /** IBKR: the first sync after connecting is still loading the purchase history. */
  loadingHistory?: boolean
  /** The group this source is stacked in. */
  groupId?: string
}

/** A named stack of sources, made in the cards' edit mode. Its card shows their total. */
/** `icon` is `<logo>:<colour>` (see `group-icon.tsx`), unset for none. */
export type Group = { id: string; name: string; icon?: string }

/** One place in the cards row: a single source, or a group with its sources (2 or more). */
export type RowItem = { kind: 'source'; portfolio: Portfolio } | { kind: 'group'; group: Group; members: Portfolio[] }

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
let groupsCache: Group[] = []
/** False until the signed-in user's data has come back from the server (shows skeletons). */
let loadedCache = false

function set(portfolios: Portfolio[], entries: Entry[], loaded = true, payouts: Payout[] = [], groups: Group[] = []) {
  portfoliosCache = portfolios
  entriesCache = entries
  payoutsCache = payouts
  groupsCache = groups
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
  // Local preview of a brand-new account: `?empty` hides the data on screen only (dev builds only).
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('empty')) return set([], [])
  set(
    sortPortfolios(data.portfolios as Portfolio[]),
    ([...data.entries] as Entry[]).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    true,
    data.payouts,
    data.groups,
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
export const useGroups = () => useSyncExternalStore(subscribe, () => groupsCache)

/** The cards row in order: a group sits where its first source is, with all its sources (a group with
    fewer than 2 left shows them as single sources). `portfolios` must already be in row order. */
export function rowItems(portfolios: Portfolio[], groups: Group[]): RowItem[] {
  const byId = new Map(groups.map((g) => [g.id, g]))
  const members = new Map<string, Portfolio[]>()
  for (const p of portfolios) if (p.groupId && byId.has(p.groupId)) members.set(p.groupId, [...(members.get(p.groupId) ?? []), p])
  const items: RowItem[] = []
  const placed = new Set<string>()
  for (const p of portfolios) {
    const list = p.groupId ? members.get(p.groupId) : undefined
    if (!p.groupId || !list || list.length < 2) items.push({ kind: 'source', portfolio: p })
    else if (!placed.has(p.groupId)) {
      placed.add(p.groupId)
      items.push({ kind: 'group', group: byId.get(p.groupId)!, members: list })
    }
  }
  return items
}

/** The sources a selected card stands for: one source, a group's sources, or none (Net worth). */
export function membersOf(id: string, portfolios: Portfolio[]) {
  const own = portfolios.filter((p) => p.groupId === id)
  return own.length >= 2 ? own : portfolios.filter((p) => p.id === id)
}

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

/** Whether a portfolio can have passive income: it holds something besides money (crypto, stocks, later
    gold or silver). Money alone only "earns" from exchange rates moving, which isn't income; so do
    Monobank portfolios, which are bank cards. (A Monobank deposit, once it can be connected, earns
    interest and should count.) */
export const earnsPassiveIncome = (p: Portfolio, entries: Entry[]) =>
  p.source !== 'monobank' && entries.some((e) => e.portfolioId === p.id && typeOf(e.asset) !== 'money')

/** Saves the picked period on the account, so the dashboard opens on it next time. */
export function savePeriod(period: Period) {
  convex
    .mutation(api.users.setPeriod, { period }, {
      optimisticUpdate: (store) => {
        const user = store.getQuery(api.users.me, {})
        if (user) store.setQuery(api.users.me, {}, { ...user, period })
      },
    })
    .catch((e) => console.error('Could not save period', e))
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

/** Saves the edit mode's result: the new order, and the groups (new, renamed, emptied). */
export function saveLayout(items: RowItem[]) {
  const order = items.flatMap((i) => (i.kind === 'source' ? [i.portfolio.id] : i.members.map((m) => m.id)))
  const groups = items.flatMap((i) => (i.kind === 'group' ? [{ id: i.group.id, name: i.group.name, icon: i.group.icon, portfolioIds: i.members.map((m) => m.id) }] : []))
  const memberOf = new Map(groups.flatMap((g) => g.portfolioIds.map((id) => [id, g.id] as const)))
  save(api.data.saveLayout, { order, groups }, (d) => ({
    ...d,
    groups: groups.map(({ id, name, icon }) => ({ id, name, icon })),
    portfolios: d.portfolios.map((p) =>
      order.includes(p.id) ? { ...p, position: order.indexOf(p.id), groupId: memberOf.get(p.id) } : p,
    ),
  }))
}

/** Stacks these sources into a new group. Returns the group's id. */
export function createGroup(name: string, portfolioIds: string[], icon?: string) {
  const id = crypto.randomUUID()
  save(api.data.createGroup, { id, name, icon, portfolioIds }, (d) => ({
    ...d,
    groups: [...d.groups, { id, name, icon }],
    portfolios: d.portfolios.map((p) => (portfolioIds.includes(p.id) ? { ...p, groupId: id } : p)),
  }))
  return id
}

/** Deleting a portfolio also deletes its entries. */
export function deletePortfolio(id: string) {
  save(api.data.deletePortfolio, { id }, (d) => ({
    ...d,
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

/** Deletes the signed-in user and everything they own (`account.deleteAccount`). */
export function deleteAccount() {
  return call(api.account.deleteAccount, {}, dict().deleteAccountFailed)
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

/** Creates a portfolio per card from its balance; the server then loads their last 31 days, one card a
    minute. Returns the new portfolios' ids. */
export function connectMonobankCards(cards: { accountId: string; name: string }[]) {
  return call(api.monobank.connect, { cards }, dict().monobank.unreachable)
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
    after that leave them out and the server uses the kept ones (null means none are kept yet).
    `trades` is false when the query lacks the Trades section, which holds the purchase dates. */
export async function listIbkrPositions(token?: string, queryId?: string) {
  return (await call(api.ibkr.positions, { token, queryId }, dict().ibkr.unreachable)) as
    | { stocks: IbkrPosition[]; trades: boolean }
    | null
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
