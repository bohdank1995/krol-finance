import type { Entry } from './entries'

/* "Fake numbers": every entry of a portfolio is scaled by one random factor (0.2×–5×) picked
   from the portfolio id and a seed. Totals still add up, the graph keeps a believable shape,
   and a balance never turns negative — but no real amount is shown. */

function hash(text: string, seed: number) {
  let h = seed ^ 0x9e3779b9
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x5bd1e995)
  h ^= h >>> 15
  return (h >>> 0) / 2 ** 32 // 0…1
}

const decimals = (amount: string) => amount.split('.')[1]?.length ?? 0

export function fakeEntries(entries: Entry[], seed: number): Entry[] {
  return entries.map((e) => {
    const factor = 0.2 * 25 ** hash(e.portfolioId, seed) // log-uniform 0.2 … 5
    const places = Math.max(2, decimals(e.amount))
    return { ...e, amount: (Number(e.amount) * factor).toFixed(places) }
  })
}
