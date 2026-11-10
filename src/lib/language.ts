import { useSyncExternalStore } from 'react'

/* Which language Koshel speaks, before and after sign-in. Ukrainian by default; English only when the
   browser's first language is English. A pick on the home page is remembered in this browser; once signed in,
   the account's saved language wins (`i18n.ts`). No Convex here, so the home page can use it at build time,
   where it's always Ukrainian. The same rule runs early in index.html, so English visitors don't see the
   Ukrainian page first. */

export const LANGUAGES = [
  { value: 'uk', label: 'UA' },
  { value: 'en', label: 'EN' },
] as const
export type Language = (typeof LANGUAGES)[number]['value']

/** What the home page is written in at build time. */
export const BUILT_IN: Language = 'uk'
const KEY = 'koshel.language'

export const isLanguage = (v: unknown): v is Language => LANGUAGES.some((l) => l.value === v)

/** This browser's pick, else English for an English browser, else Ukrainian. */
export function detectLanguage(): Language {
  try {
    const saved = localStorage.getItem(KEY)
    if (isLanguage(saved)) return saved
  } catch {
    // Storage blocked: fall back to the browser's language.
  }
  const first = navigator.languages?.[0] ?? navigator.language ?? ''
  return /^en\b/i.test(first) ? 'en' : 'uk'
}

const listeners = new Set<() => void>()
let current: Language = typeof window === 'undefined' ? BUILT_IN : detectLanguage()

/** Switches the language on screen; `remember` keeps it for this browser's next visit. */
export function applyLanguage(language: Language, { remember = false } = {}) {
  if (remember)
    try {
      localStorage.setItem(KEY, language)
    } catch {
      // Storage blocked: it just won't be remembered.
    }
  document.documentElement.lang = language
  if (language === current) return
  current = language
  listeners.forEach((l) => l())
}

export const currentLanguage = () => current

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The current language; re-renders when it changes. The ready-made home page is hydrated in Ukrainian first. */
export const useLanguage = () => useSyncExternalStore(subscribe, () => current, () => BUILT_IN)
