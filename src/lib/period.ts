/* The period being tracked. Days are UTC "YYYY-MM-DD", matching the graph's daily points. Weeks start on Monday. */

/** Their names are in `i18n.ts` (`periods`). */
export const PRESETS = [
  'today',
  'yesterday',
  'last-hour',
  'last-24-hours',
  'last-7-days',
  'last-14-days',
  'last-30-days',
  'last-90-days',
  'last-180-days',
  'last-week',
  'last-month',
  'this-week',
  'this-month',
  'this-year',
  'all',
] as const

export type Preset = (typeof PRESETS)[number]

/** Units of the "In the last N …" row. */
export const UNITS = ['days', 'weeks', 'months', 'years'] as const

export type Unit = (typeof UNITS)[number]

/** A preset, or a custom "In the last N units". */
export type Period = Preset | { last: number; unit: Unit }

/**
 * First and last day of the period; `from` is unset for All time.
 * `since` is the exact start for the hour-sized periods, so the table can leave out older entries of the same day.
 */
export type Range = { from?: string; to: string; since?: string }

const day = (d: Date) => d.toISOString().slice(0, 10)

/** The last `n` units up to and including today. */
function last(n: number, unit: Unit, now: Date): Range {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const d = now.getUTCDate()
  const from = {
    days: Date.UTC(y, m, d - n + 1),
    weeks: Date.UTC(y, m, d - 7 * n + 1),
    months: Date.UTC(y, m - n, d + 1),
    years: Date.UTC(y - n, m, d + 1),
  }[unit]
  return { from: day(new Date(from)), to: day(now) }
}

/** The exact time `hours` ago. */
function hoursAgo(hours: number, now: Date): Range {
  const since = new Date(now.getTime() - hours * 3_600_000)
  return { from: day(since), to: day(now), since: since.toISOString() }
}

export function rangeOf(period: Period, now = new Date()): Range {
  if (typeof period === 'object') return last(period.last, period.unit, now)
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const d = now.getUTCDate()
  const today = day(now)
  // Days since Monday.
  const weekday = (now.getUTCDay() + 6) % 7
  switch (period) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday': {
      const yesterday = day(new Date(Date.UTC(y, m, d - 1)))
      return { from: yesterday, to: yesterday }
    }
    case 'last-hour':
      return hoursAgo(1, now)
    case 'last-24-hours':
      return hoursAgo(24, now)
    case 'last-7-days':
      return last(7, 'days', now)
    case 'last-14-days':
      return last(14, 'days', now)
    case 'last-30-days':
      return last(30, 'days', now)
    case 'last-90-days':
      return last(90, 'days', now)
    case 'last-180-days':
      return last(180, 'days', now)
    case 'last-week':
      return { from: day(new Date(Date.UTC(y, m, d - weekday - 7))), to: day(new Date(Date.UTC(y, m, d - weekday - 1))) }
    case 'last-month':
      return { from: day(new Date(Date.UTC(y, m - 1, 1))), to: day(new Date(Date.UTC(y, m, 0))) }
    case 'this-week':
      return { from: day(new Date(Date.UTC(y, m, d - weekday))), to: today }
    case 'this-month':
      return { from: day(new Date(Date.UTC(y, m, 1))), to: today }
    case 'this-year':
      return { from: day(new Date(Date.UTC(y, 0, 1))), to: today }
    case 'all':
      return { to: today }
  }
}

/** Whether an ISO timestamp falls inside the range (whole days, UTC; exact time for `since`). */
export function inRange(iso: string, { from, to, since }: Range) {
  const d = iso.slice(0, 10)
  return (!from || d >= from) && d <= to && (!since || iso >= since)
}
