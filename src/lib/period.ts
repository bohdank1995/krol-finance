/* The period being tracked. Days are UTC "YYYY-MM-DD", matching the graph's daily points. */

/** Their names are in `i18n.ts` (`periods`). */
export const PERIODS = ['all', 'last-month', 'prev-month', 'last-quarter', 'last-year'] as const

export type Period = (typeof PERIODS)[number]

/** First and last day of the period; `from` is unset for All time. */
export type Range = { from?: string; to: string }

const day = (d: Date) => d.toISOString().slice(0, 10)

export function rangeOf(period: Period, now = new Date()): Range {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const d = now.getUTCDate()
  const today = day(now)
  switch (period) {
    case 'all':
      return { to: today }
    case 'last-month':
      return { from: day(new Date(Date.UTC(y, m, d - 30))), to: today }
    case 'prev-month':
      return { from: day(new Date(Date.UTC(y, m - 1, 1))), to: day(new Date(Date.UTC(y, m, 0))) }
    case 'last-quarter':
      return { from: day(new Date(Date.UTC(y, m - 3, d))), to: today }
    case 'last-year':
      return { from: day(new Date(Date.UTC(y - 1, m, d))), to: today }
  }
}

/** Whether an ISO timestamp falls inside the range (whole days, UTC). */
export function inRange(iso: string, { from, to }: Range) {
  const d = iso.slice(0, 10)
  return (!from || d >= from) && d <= to
}
