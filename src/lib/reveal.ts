import { useEffect, useState } from 'react'

/* The page's entrance plays once: the cards, graph and table wait until their data and prices are in,
   then all fade in together (one after another). Placeholders only show when loading is slow, so a
   normal load never swaps a placeholder for the real thing mid-animation. */

/** Loading takes longer than this: show placeholders meanwhile. */
const SLOW = 900
/** Never hold the page back longer than this after the data arrives (a price feed may be down). */
const CAP = 2500

/** `ready` latches true once `done` (or CAP after `loaded`); `slow` is true while waiting past SLOW. */
export function useReveal(loaded: boolean, done: boolean) {
  const [revealed, setRevealed] = useState(false)
  const [slow, setSlow] = useState(false)
  // Latch while rendering, so later gaps (a new asset being priced) never hide the page again.
  if (loaded && done && !revealed) setRevealed(true)
  const ready = revealed || (loaded && done)

  useEffect(() => {
    if (ready) return
    const timer = window.setTimeout(() => setSlow(true), SLOW)
    return () => window.clearTimeout(timer)
  }, [ready])

  useEffect(() => {
    if (!loaded || ready) return
    const timer = window.setTimeout(() => setRevealed(true), CAP)
    return () => window.clearTimeout(timer)
  }, [loaded, ready])

  return { ready, slow: slow && !ready }
}
