import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** Pixels per second the text moves at; long labels take longer, short ones don't rush. */
const SPEED = 25

/**
 * One line of text that fits its box. When it's too long, its right edge fades out and the text
 * slowly slides left to show the rest, then back (like song titles in Spotify).
 */
export function Marquee({ children, className }: { children: React.ReactNode; className?: string }) {
  const box = useRef<HTMLSpanElement>(null)
  const text = useRef<HTMLSpanElement>(null)
  const [overflow, setOverflow] = useState(0)

  useLayoutEffect(() => {
    if (!box.current || !text.current) return
    const measure = () => setOverflow(Math.max(0, Math.ceil(text.current!.scrollWidth - box.current!.clientWidth)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box.current)
    observer.observe(text.current)
    return () => observer.disconnect()
  }, [])

  // Room to slide past the fade, so the last letters end up fully visible.
  const shift = overflow > 0 ? overflow + 24 : 0
  return (
    <span ref={box} className={cn('block overflow-hidden whitespace-nowrap', shift > 0 && 'fade-right', className)}>
      <span
        ref={text}
        className={cn('inline-block', shift > 0 && 'animate-marquee')}
        style={
          shift > 0
            ? ({ '--marquee-shift': `-${shift}px`, '--marquee-time': `${Math.max(6, (2 * shift) / SPEED + 4)}s` } as React.CSSProperties)
            : undefined
        }
      >
        {children}
      </span>
    </span>
  )
}
