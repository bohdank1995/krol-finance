import { useSyncExternalStore } from 'react'

/* Per-device view preferences, remembered in this browser: the display currency and
   "Fake numbers" mode (with the seed its fake values are made from, so a reload keeps them). */

export const CURRENCIES = ['USD', 'EUR', 'UAH'] as const
export type Currency = (typeof CURRENCIES)[number]

type Preferences = { currency: Currency; fake: boolean; fakeSeed: number }

const KEY = 'krol:preferences'
const DEFAULTS: Preferences = { currency: 'USD', fake: false, fakeSeed: 1 }

function read(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Preferences>
    return {
      currency: CURRENCIES.includes(saved.currency as Currency) ? (saved.currency as Currency) : DEFAULTS.currency,
      fake: saved.fake === true,
      fakeSeed: typeof saved.fakeSeed === 'number' ? saved.fakeSeed : DEFAULTS.fakeSeed,
    }
  } catch {
    return DEFAULTS
  }
}

const listeners = new Set<() => void>()
let current = read()

function update(patch: Partial<Preferences>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // Storage blocked (private window): the choice still applies until reload.
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const usePreferences = () => useSyncExternalStore(subscribe, () => current)

export const setCurrency = (currency: Currency) => update({ currency })

/** Turning fake mode on rolls new fake numbers each time. */
export const setFake = (fake: boolean) =>
  update(fake ? { fake, fakeSeed: Math.floor(Math.random() * 2 ** 31) } : { fake })
