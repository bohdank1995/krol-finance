import { useEffect, useRef, useState } from 'react'

/* Numbers that look encrypted while loading, then decode into the real values: a quiet hint that the
   data is kept safe. Mono font only, so every character has the same width and nothing jumps. */

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*'
/** The first frame, also what the build-time loading screen shows before JavaScript runs. */
const STILL = 'K7#Q9$X2@M4&Z8'

const random = (length: number) =>
  Array.from({ length }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join('')
const calm = () => typeof window === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches

/** How often the characters change, in milliseconds. */
const STEP = 60

/** Loading placeholder: `length` characters that keep changing. */
export function Scrambling({ length, className }: { length: number; className?: string }) {
  const [text, setText] = useState(() => STILL.slice(0, length))
  useEffect(() => {
    if (calm()) return
    const timer = window.setInterval(() => setText(random(length)), STEP)
    return () => window.clearInterval(timer)
  }, [length])
  return (
    <span aria-hidden className={className}>
      {text}
    </span>
  )
}

/** Shows `text`. When it first appears it decodes from random characters, left to right, over `duration`. */
export function Decode({ text, duration = 1000 }: { text: string; duration?: number }) {
  const [shown, setShown] = useState<string | undefined>(() => (calm() ? undefined : random(text.length)))
  const latest = useRef(text)
  useEffect(() => {
    latest.current = text
  })
  useEffect(() => {
    if (shown === undefined) return
    // A timer rather than animation frames: frames pause in a background tab, which would leave the number garbled.
    const start = performance.now()
    const timer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / duration)
      const target = latest.current
      const fixed = Math.floor(progress * target.length)
      setShown(progress === 1 ? undefined : target.slice(0, fixed) + random(target.length - fixed))
      if (progress === 1) window.clearInterval(timer)
    }, STEP)
    return () => window.clearInterval(timer)
    // Plays once, when the number first appears; later changes show straight away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <span aria-label={text}>{shown ?? text}</span>
}
