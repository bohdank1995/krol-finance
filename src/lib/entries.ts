import { useSyncExternalStore } from 'react'
import type { AssetSymbol } from './assets'
import { supabase } from './supabase'

/* Portfolios (the cards) and their entries (the rows) live in Supabase, locked to the
   signed-in user by Row Level Security. Everything goes through this module. The
   in-memory cache updates instantly; the database write follows, and is rolled back
   on failure. An entry is a change: positive adds to the portfolio, negative takes away. */

export type Portfolio = {
  id: string
  name: string
  createdAt: string
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

type PortfolioRow = { id: string; name: string; created_at: string }
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

async function load() {
  const [h, e] = await Promise.all([
    supabase.from('portfolios').select('id, name, created_at').order('created_at', { ascending: true }),
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
    (h.data as PortfolioRow[]).map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at })),
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
  const portfolio: Portfolio = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString() }
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
