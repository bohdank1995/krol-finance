import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import type { AssetSymbol } from '@/lib/assets'
import { deletePortfolio, type Entry, type Portfolio } from '@/lib/entries'
import { formatUsd } from '@/lib/format'
import { balance } from '@/lib/portfolio'
import type { PriceStatus } from '@/lib/prices'
import { cn } from '@/lib/utils'
import { PortfolioDrawer } from './portfolio-drawer'

export const NET_WORTH = 'all'

// Below `sm` the row is a one-card-per-screen carousel: swiping selects the card.
const MOBILE = '(max-width: 639px)'

// The slide whose centre is closest to the row's centre ('' for the add card).
function centredSlide(row: HTMLElement) {
  const centre = row.scrollLeft + row.clientWidth / 2
  let best: string | undefined
  let distance = Infinity
  for (const el of row.querySelectorAll<HTMLElement>('[data-slide]')) {
    const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - centre)
    if (d < distance) [best, distance] = [el.dataset.slide, d]
  }
  return best
}

type Props = {
  portfolios: Portfolio[]
  entries: Entry[]
  prices: Partial<Record<AssetSymbol, number>>
  status: PriceStatus
  selected: string
  onSelect: (id: string) => void
}

export function PortfolioCards({ portfolios, entries, prices, status, selected, onSelect }: Props) {
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<Portfolio>()
  const [deleting, setDeleting] = useState<Portfolio>()
  const rowRef = useRef<HTMLDivElement>(null)
  const latest = useRef({ selected, onSelect })
  useEffect(() => {
    latest.current = { selected, onSelect }
  })
  const slides = [{ id: NET_WORTH, label: 'Net worth' }, ...portfolios.map((p) => ({ id: p.id, label: p.name }))]

  // A swipe that settles on a card makes it the active one.
  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const settle = () => {
      if (!matchMedia(MOBILE).matches) return
      const id = centredSlide(row)
      if (id && id !== latest.current.selected) latest.current.onSelect(id)
    }
    if ('onscrollend' in window) {
      row.addEventListener('scrollend', settle)
      return () => row.removeEventListener('scrollend', settle)
    }
    let timer: ReturnType<typeof setTimeout>
    const onScroll = () => {
      clearTimeout(timer)
      timer = setTimeout(settle, 100)
    }
    row.addEventListener('scroll', onScroll)
    return () => {
      clearTimeout(timer)
      row.removeEventListener('scroll', onScroll)
    }
  }, [])

  // Selecting another way (dot, new or deleted portfolio) brings that card into view.
  useEffect(() => {
    const row = rowRef.current
    if (!row || !matchMedia(MOBILE).matches || centredSlide(row) === selected) return
    const el = row.querySelector<HTMLElement>(`[data-slide="${CSS.escape(selected)}"]`)
    if (el) row.scrollTo({ left: el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
  }, [selected, portfolios.length])

  return (
    <div>
      <div
        ref={rowRef}
        role="tablist"
        aria-label="Portfolios"
        className="relative -mx-6 flex snap-x snap-mandatory gap-2 overflow-x-auto px-8 pb-2 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden sm:snap-none sm:gap-3 sm:px-6"
      >
        <Card
          id={NET_WORTH}
          label="Net worth"
          entries={entries}
          prices={prices}
          active={selected === NET_WORTH}
          onSelect={() => onSelect(NET_WORTH)}
          live={entries.length > 0 ? status : undefined}
        />
        {portfolios.map((h) => (
          <Card
            key={h.id}
            id={h.id}
            label={h.name}
            entries={entries.filter((e) => e.portfolioId === h.id)}
            prices={prices}
            active={selected === h.id}
            onSelect={() => onSelect(h.id)}
            menu={
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${h.name} actions`}
                      className="absolute top-2 right-2 text-faint-foreground hover:text-foreground aria-expanded:text-foreground"
                    />
                  }
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => setRenaming(h)}>
                    <Pencil className="text-muted-foreground" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleting(h)}>
                    <Trash2 />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
        ))}
        <button
          type="button"
          data-slide=""
          onClick={() => setCreating(true)}
          className="flex min-h-[120px] w-[calc(100vw-4rem)] shrink-0 snap-center snap-always items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground sm:min-h-[104px] sm:w-24"
        >
          <Plus />
          <span className="sm:sr-only">Add portfolio</span>
        </button>
      </div>

      {slides.length > 1 && (
        <div className="mt-2 flex justify-center sm:hidden">
          {slides.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Show ${s.label}`}
              aria-current={s.id === selected}
              onClick={() => onSelect(s.id)}
              className="p-1"
            >
              <span
                className={cn(
                  'block h-1.5 rounded-full transition-all',
                  s.id === selected ? 'w-4 bg-foreground' : 'w-1.5 bg-faint-foreground',
                )}
              />
            </button>
          ))}
        </div>
      )}

      <PortfolioDrawer open={creating} onOpenChange={setCreating} onCreated={onSelect} />
      <PortfolioDrawer
        open={!!renaming}
        onOpenChange={(open) => !open && setRenaming(undefined)}
        portfolio={renaming}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(undefined)}>
        <AlertDialogContent size="sm" className="gap-6 p-6">
          <AlertDialogTitle className="text-sm font-normal text-muted-foreground">
            Delete <span className="text-foreground">{deleting?.name}</span> and all its entries?
          </AlertDialogTitle>
          <AlertDialogFooter className="-mx-6 -mb-6 px-6 py-4">
            <AlertDialogCancel variant="ghost">Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  if (selected === deleting.id) onSelect(NET_WORTH)
                  deletePortfolio(deleting.id)
                }
                setDeleting(undefined)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Placeholder row while portfolios load: Net worth plus two cards, same size as the real ones. */
export function PortfolioCardsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading portfolios" className="-mx-6 flex gap-2 overflow-hidden px-8 pb-2 sm:gap-3 sm:px-6">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex min-h-[120px] w-[calc(100vw-4rem)] shrink-0 flex-col justify-between rounded-xl border bg-card p-5 sm:min-h-[104px] sm:w-48"
        >
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="mt-4 h-6 w-28 sm:h-5" />
        </div>
      ))}
    </div>
  )
}

type CardProps = {
  id: string
  label: string
  entries: Entry[]
  prices: Partial<Record<AssetSymbol, number>>
  active: boolean
  onSelect: () => void
  menu?: React.ReactNode
  live?: PriceStatus
}

function Card({ id, label, entries, prices, active, onSelect, menu, live }: CardProps) {
  const { total, pricing } = balance(entries, prices)
  return (
    <div data-slide={id} className="relative w-[calc(100vw-4rem)] shrink-0 snap-center snap-always sm:w-48">
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={onSelect}
        className={cn(
          'flex min-h-[120px] w-full flex-col justify-between rounded-xl border bg-card p-5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-[104px]',
          active ? 'border-foreground/30 bg-accent' : 'hover:border-foreground/15',
        )}
      >
        <span className="flex items-center gap-2 pr-6 text-sm text-muted-foreground">
          <span className="truncate">{label}</span>
          {live && <LiveDot status={live} />}
        </span>
        <span className="mt-4 flex items-baseline gap-1.5 font-mono tabular-nums">
          <span className={cn('text-2xl transition-opacity sm:text-xl', pricing && 'opacity-50')}>{formatUsd(total)}</span>
          <span className="text-xs text-muted-foreground">USD</span>
        </span>
      </button>
      {menu}
    </div>
  )
}

function LiveDot({ status }: { status: PriceStatus }) {
  const live = status === 'live'
  return (
    <span className="relative flex size-2 shrink-0" title={live ? 'Live' : 'Reconnecting'}>
      {live && <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-40" />}
      <span className={cn('relative size-2 rounded-full', live ? 'bg-brand' : 'bg-faint-foreground')} />
    </span>
  )
}
