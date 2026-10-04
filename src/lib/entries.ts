import { useSyncExternalStore } from 'react'
import type { AssetSymbol, StockSymbol } from './assets'
import { supabase } from './supabase'

/* Portfolios (the cards) and their entries (the rows) live in Supabase, locked to the
   signed-in user by Row Level Security. Everything goes through this module. The
   in-memory cache updates instantly; the database write follows, and is rolled back
   on failure. An entry is a change: positive adds to the portfolio, negative takes away. */

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
}

type PortfolioRow = {
  id: string
  name: string
  created_at: string
  source: Portfolio['source']
  synced_at: string | null
  /** Missing until migration 0007 is run. */
  position?: number | null
}
type EntryRow = {
  id: string
  portfolio_id: string
  asset: AssetSymbol
  amount: string | number
  created_at: string
  note: string | null
}

const listeners = new Set<() => void>()
let portfoliosCache: Portfolio[] = []
let entriesCache: Entry[] = []
/** False until the signed-in user's data has come back from the server (shows skeletons). */
let loadedCache = false

function set(portfolios: Portfolio[], entries: Entry[], loaded = true) {
  portfoliosCache = portfolios
  entriesCache = entries
  loadedCache = loaded
  listeners.forEach((l) => l())
}

/** Dragged order first, then the rest (new ones, never-dragged ones) by creation. */
function sortPortfolios(list: Portfolio[]) {
  const rank = (p: Portfolio) => p.position ?? Infinity
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.createdAt < b.createdAt ? -1 : 1))
}

async function load() {
  const [h, e] = await Promise.all([
    // '*' rather than a column list, so loading still works before the `position` migration is run.
    supabase.from('portfolios').select('*').order('created_at', { ascending: true }),
    supabase
      .from('entries')
      .select('id, portfolio_id, asset, amount, created_at, note')
      .order('created_at', { ascending: false }),
  ])
  if (h.error || e.error) {
    console.error('Could not load data', h.error ?? e.error)
    return set([], []) // stop the skeletons; the empty state is shown instead
  }
  set(
    sortPortfolios(
      (h.data as PortfolioRow[]).map((r) => ({
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
        source: r.source,
        syncedAt: r.synced_at ?? undefined,
        position: r.position ?? undefined,
      })),
    ),
    (e.data as EntryRow[]).map((r) => ({
      id: r.id,
      portfolioId: r.portfolio_id,
      asset: r.asset,
      amount: String(r.amount),
      createdAt: r.created_at,
      note: r.note ?? undefined,
    })),
  )
}

// Reload on sign-in, clear on sign-out. Token refreshes don't change the user, so skip them.
let userId: string | undefined
supabase.auth.onAuthStateChange((_event, session) => {
  const next = session?.user.id
  if (next === userId) return
  userId = next
  if (next) setTimeout(load, 0) // never call Supabase inside the auth callback itself
  else set([], [], false)
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const usePortfolios = () => useSyncExternalStore(subscribe, () => portfoliosCache)
export const useEntries = () => useSyncExternalStore(subscribe, () => entriesCache)
export const useLoaded = () => useSyncExternalStore(subscribe, () => loadedCache)

/** Runs the writes in order; if any fails, puts the previous data back. */
async function commit(
  previous: [Portfolio[], Entry[]],
  ...requests: (() => PromiseLike<{ error: unknown }>)[]
) {
  for (const request of requests) {
    const { error } = await request()
    if (error) {
      console.error('Could not save change', error)
      set(...previous)
      return
    }
  }
}

const snapshot = (): [Portfolio[], Entry[]] => [portfoliosCache, entriesCache]

type EntryInput = { asset: AssetSymbol; amount: string; createdAt?: string; note?: string }

function newEntry(portfolioId: string, input: EntryInput): Entry {
  return {
    id: crypto.randomUUID(),
    portfolioId,
    asset: input.asset,
    amount: input.amount,
    createdAt: input.createdAt ?? new Date().toISOString(),
    note: input.note,
  }
}

const entryRow = (e: Entry) => ({
  id: e.id,
  portfolio_id: e.portfolioId,
  asset: e.asset,
  amount: e.amount,
  created_at: e.createdAt,
  note: e.note ?? null,
})

/** Creates an empty portfolio (entries are added afterwards). Returns its id. */
export function addPortfolio(name: string) {
  const portfolio: Portfolio = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), source: 'manual' }
  const previous = snapshot()
  set([...portfoliosCache, portfolio], entriesCache)
  commit(previous, () =>
    supabase.from('portfolios').insert({ id: portfolio.id, name, created_at: portfolio.createdAt }),
  )
  return portfolio.id
}

export function renamePortfolio(id: string, name: string) {
  const previous = snapshot()
  set(portfoliosCache.map((h) => (h.id === id ? { ...h, name } : h)), entriesCache)
  commit(previous, () => supabase.from('portfolios').update({ name }).eq('id', id))
}

/** Saves a new card order (`ids` in display order). */
export function reorderPortfolios(ids: string[]) {
  const previous = snapshot()
  const byId = new Map(portfoliosCache.map((p) => [p.id, p]))
  const next = ids.flatMap((id, position) => {
    const p = byId.get(id)
    return p ? [{ ...p, position }] : []
  })
  const changed = next.filter((p) => byId.get(p.id)?.position !== p.position)
  set(next, entriesCache)
  commit(
    previous,
    ...changed.map((p) => () => supabase.from('portfolios').update({ position: p.position }).eq('id', p.id)),
  )
}

/** Deleting a portfolio also deletes its entries (the database cascades). */
export function deletePortfolio(id: string) {
  const previous = snapshot()
  set(
    portfoliosCache.filter((h) => h.id !== id),
    entriesCache.filter((e) => e.portfolioId !== id),
  )
  commit(previous, () => supabase.from('portfolios').delete().eq('id', id))
}

export function addEntry(portfolioId: string, input: EntryInput) {
  const entry = newEntry(portfolioId, input)
  const previous = snapshot()
  set(portfoliosCache, [entry, ...entriesCache])
  commit(previous, () => supabase.from('entries').insert(entryRow(entry)))
}

export function updateEntry(id: string, patch: Omit<Entry, 'id'>) {
  const previous = snapshot()
  set(portfoliosCache, entriesCache.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  commit(previous, () =>
    supabase
      .from('entries')
      .update({
        portfolio_id: patch.portfolioId,
        asset: patch.asset,
        amount: patch.amount,
        created_at: patch.createdAt,
        note: patch.note ?? null,
      })
      .eq('id', id),
  )
}

export function deleteEntry(id: string) {
  const previous = snapshot()
  set(portfoliosCache, entriesCache.filter((e) => e.id !== id))
  commit(previous, () => supabase.from('entries').delete().eq('id', id))
}

/** Synced portfolios (Monobank, IBKR) can't have entries added, edited or deleted by hand. */
export const isReadOnly = (p: Portfolio | undefined) => !!p && p.source !== 'manual'

/** Calls an Edge Function; its `{ error }` reply becomes the thrown message. */
export async function invoke<T>(name: string, body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    const context = (error as { context?: Response }).context
    const reply = await context?.json?.().catch(() => undefined)
    throw new Error(reply?.error ?? fallback)
  }
  return data as T
}

/* Monobank: the token goes to the `monobank` Edge Function, which keeps it server-side,
   talks to Monobank and writes the portfolio + entries. The app then reloads. */

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

const monobank = <T>(body: Record<string, string>) => invoke<T>('monobank', body, 'Could not reach Monobank. Try again.')

/** Checks the token with Monobank and lists the cards it can see. */
export async function listMonobankCards(token: string) {
  const { cards } = await monobank<{ cards: MonobankCard[] }>({ action: 'cards', token })
  return cards
}

/** Creates a portfolio for the card with its last 31 days of transactions. Returns its id. */
export async function connectMonobankCard(accountId: string, name: string) {
  const { portfolioId } = await monobank<{ portfolioId: string }>({ action: 'connect', accountId, name })
  await load()
  return portfolioId
}

/* Interactive Brokers: the Flex token + Query ID go to the `ibkr` Edge Function, which keeps them
   server-side, reads the account's stocks and writes the portfolio + entries. The app then reloads. */

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

const ibkr = <T>(body: Record<string, unknown>) => invoke<T>('ibkr', body, 'Could not reach Interactive Brokers. Try again.')

/** Runs the Flex Query and lists the stocks in the account. */
export async function listIbkrPositions(token: string, queryId: string) {
  const { positions } = await ibkr<{ positions: IbkrPosition[] }>({ action: 'positions', token, queryId })
  return positions
}

/** Creates a portfolio with the picked stocks (`all`: every stock, also ones bought later). Returns its id. */
export async function connectIbkr(name: string, assets: StockSymbol[], all: boolean) {
  const { portfolioId } = await ibkr<{ portfolioId: string }>({ action: 'connect', name, assets, all })
  await load()
  return portfolioId
}
