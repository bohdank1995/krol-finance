const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const qty = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 })
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')

export const formatMoney = (n: number) => money.format(n)
export const formatAmount = (s: string) => qty.format(Number(s))
/** "+0.2" / "−0.05": entries are changes, so the sign is always shown. */
export function formatSigned(s: string) {
  const n = Number(s)
  return `${n < 0 ? '−' : '+'}${qty.format(Math.abs(n))}`
}
export function formatDate(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
/** "just now", "12m ago", "3h ago", "2d ago". */
export function formatAgo(iso: string) {
  const minutes = Math.floor((Date.now() - Date.parse(iso)) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`
  return `${Math.floor(minutes / (60 * 24))}d ago`
}
export const formatDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return `${pad(d)} ${MONTHS[m - 1]} ${y}`
}

/** Local calendar day of an ISO timestamp, as "YYYY-MM-DD" (what a date input uses). */
export function localDay(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Accepts "1,5", "1.5", "-0.2", "+3"; returns a canonical signed decimal string, or null if invalid or zero. */
export function parseAmount(input: string): string | null {
  const s = input.trim().replace(/\s/g, '').replace(',', '.').replace('−', '-')
  const m = /^([+-]?)(\d*\.?\d+|\d+\.)$/.exec(s)
  if (!m) return null
  const body = m[2].replace(/^\./, '0.').replace(/\.$/, '')
  const n = Number(body)
  if (!Number.isFinite(n) || n === 0) return null
  return (m[1] === '-' ? '-' : '') + body
}

/** A date input gives a day; keep the original time if the day didn't change. */
export function dayToIso(day: string, original?: string) {
  const sameDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA') === day
  if (original && sameDay(original)) return original
  const now = new Date().toISOString()
  if (sameDay(now)) return now
  return new Date(`${day}T12:00:00`).toISOString()
}

/** Keeps digits and one decimal point: "1,000.50" → "1000.50"; "007" → "7". */
export function cleanAmount(s: string) {
  let out = ''
  for (const c of s) {
    if (c >= '0' && c <= '9') out += c
    else if (c === '.' && !out.includes('.')) out += c
  }
  return out.replace(/^0+(?=\d)/, '')
}

/** Thousands commas in the whole part, like everywhere else in the app: "1000000.5" → "1,000,000.5". */
export function groupAmount(clean: string) {
  const [whole, fraction] = clean.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}
