import { useSyncExternalStore } from 'react'
import type { CryptoSymbol } from './assets'
import { supabase } from './supabase'

/* Entries live in Supabase, one row per entry, locked to the signed-in user by
   Row Level Security. Everything goes through this module. The in-memory cache
   updates instantly; the database write follows, and is rolled back on failure. */

export type Entry = {
  id: string
  kind: 'crypto'
  asset: CryptoSymbol
  /** Decimal string, kept exactly as typed (normalised to a dot separator). */
  amount: string
  /** ISO timestamp of when the entry was logged. */
  createdAt: string
}

type Row = { id: string; kind: 'crypto'; asset: CryptoSymbol; amount: string | number; created_at: string }

const listeners = new Set<() => void>()
let cache: Entry[] = []

function set(next: Entry[]) {
  cache = next
  listeners.forEach((l) => l())
}

function fromRow(r: Row): Entry {
  return { id: r.id, kind: r.kind, asset: r.asset, amount: String(r.amount), createdAt: r.created_at }
}

async function load() {
  const { data, error } = await supabase
    .from('entries')
    .select('id, kind, asset, amount, created_at')
    .order('created_at', { ascending: false })
  if (error) return console.error('Could not load entries', error)
  set((data as Row[]).map(fromRow))
}

// Reload on sign-in, clear on sign-out. Token refreshes don't change the user, so skip them.
let userId: string | undefined
supabase.auth.onAuthStateChange((_event, session) => {
  const next = session?.user.id
  if (next === userId) return
  userId = next
  if (next) setTimeout(load, 0) // never call Supabase inside the auth callback itself
  else set([])
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useEntries() {
  return useSyncExternalStore(subscribe, () => cache)
}

async function commit(previous: Entry[], request: PromiseLike<{ error: unknown }>) {
  const { error } = await request
  if (error) {
    console.error('Could not save change', error)
    set(previous)
  }
}

export function addEntry(asset: CryptoSymbol, amount: string) {
  const entry: Entry = {
    id: crypto.randomUUID(),
    kind: 'crypto',
    asset,
    amount,
    createdAt: new Date().toISOString(),
  }
  const previous = cache
  set([entry, ...cache])
  commit(
    previous,
    supabase
      .from('entries')
      .insert({ id: entry.id, kind: entry.kind, asset, amount, created_at: entry.createdAt }),
  )
}

export function updateEntry(id: string, asset: CryptoSymbol, amount: string) {
  const previous = cache
  set(cache.map((e) => (e.id === id ? { ...e, asset, amount } : e)))
  commit(previous, supabase.from('entries').update({ asset, amount }).eq('id', id))
}

export function deleteEntry(id: string) {
  const previous = cache
  set(cache.filter((e) => e.id !== id))
  commit(previous, supabase.from('entries').delete().eq('id', id))
}
