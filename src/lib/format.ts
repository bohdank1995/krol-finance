const usdc = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const qty = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 })
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')

export const formatUsdc = (n: number) => usdc.format(n)
export const formatAmount = (s: string) => qty.format(Number(s))
export function formatDate(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Accepts "1,5" or "1.5"; returns a canonical decimal string, or null if invalid. */
export function parseAmount(input: string): string | null {
  const s = input.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0) return null
  return s.replace(/^\./, '0.').replace(/\.$/, '')
}
