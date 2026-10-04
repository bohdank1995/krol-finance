import { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS as DndCSS } from '@dnd-kit/utilities'
import { Landmark, MoreHorizontal, Pencil, Plus, Trash2, Unlink, WalletCards } from 'lucide-react'
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
import { deletePortfolio, reorderPortfolios, type Entry, type Portfolio } from '@/lib/entries'
import { formatAgo, formatMoney } from '@/lib/format'
import type { DailyPrices } from '@/lib/history'
import type { Range } from '@/lib/period'
import { balance, series, valueOn } from '@/lib/portfolio'
import type { Currency } from '@/lib/preferences'
import type { PriceStatus } from '@/lib/prices'
import { cn } from '@/lib/utils'
import { MonobankDrawer } from './monobank-drawer'
import { PortfolioDrawer } from './portfolio-drawer'

export const NET_WORTH = 'all'

// Below `sm` the row is a one-card-per-screen carousel: swiping selects the card.
const MOBILE = '(width < 40rem)'

// The slide whose centre is closest to the row's centre.
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

type Valuation = {
  prices: Partial<Record<AssetSymbol, number>>
  daily: DailyPrices
  currency: Currency
  range: Range
}

type Props = Valuation & {
  portfolios: Portfolio[]
  entries: Entry[]
  status: PriceStatus
  selected: string
  onSelect: (id: string) => void
  /** Fake numbers mode: no renaming, deleting or dragging. */
  readOnly: boolean
}

export function PortfolioCards({ portfolios, entries, status, selected, onSelect, readOnly, ...valuation }: Props) {
  const [creating, setCreating] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [renaming, setRenaming] = useState<Portfolio>()
  const [deleting, setDeleting] = useState<Portfolio>()
  const rowRef = useRef<HTMLDivElement>(null)
  const latest = useRef({ selected, onSelect })
  useEffect(() => {
    latest.current = { selected, onSelect }
  })
  const slides = [{ id: NET_WORTH, label: 'Net worth' }, ...portfolios.map((p) => ({ id: p.id, label: p.name }))]

  // Mouse: drag after moving a few pixels, so a click still selects. Touch: long-press, so a swipe still scrolls.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const ids = portfolios.map((p) => p.id)
    reorderPortfolios(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

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
      <div className="relative">
        <div
          ref={rowRef}
          role="tablist"
          aria-label="Portfolios"
          className="relative -mx-6 flex snap-x snap-mandatory gap-2 overflow-x-auto px-8 pb-2 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden sm:snap-none sm:gap-3 sm:px-6 sm:pr-24"
        >
          <Card
            id={NET_WORTH}
            label="Net worth"
            entries={entries}
            {...valuation}
            active={selected === NET_WORTH}
            onSelect={() => onSelect(NET_WORTH)}
            live={entries.length > 0 ? status : undefined}
          />
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={portfolios.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
              {portfolios.map((h) => (
                <Card
                  key={h.id}
                  id={h.id}
                  sortable={!readOnly}
                  label={h.name}
                  hint={h.syncedAt && `Synced ${formatAgo(h.syncedAt)}`}
                  entries={entries.filter((e) => e.portfolioId === h.id)}
                  {...valuation}
                  active={selected === h.id}
                  onSelect={() => onSelect(h.id)}
                  menu={
                    !readOnly && (
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
                            {h.source === 'monobank' ? <Unlink /> : <Trash2 />}
                            {h.source === 'monobank' ? 'Disconnect' : 'Delete'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  }
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Pinned to the right over a fade: stays put while the cards scroll underneath. */}
        <div className="pointer-events-none absolute inset-y-0 -right-6 flex w-16 items-center justify-end bg-linear-to-l from-background via-background/80 to-transparent pr-0.5 pb-2 sm:w-28 sm:pr-6">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Add portfolio"
                  className="pointer-events-auto rounded-full text-muted-foreground shadow-sm hover:text-foreground aria-expanded:text-foreground max-sm:size-7"
                />
              }
            >
              <Plus />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setCreating(true)}>
                <WalletCards className="text-muted-foreground" />
                Custom
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConnecting(true)}>
                <Landmark className="text-muted-foreground" />
                Monobank
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
      <MonobankDrawer open={connecting} onOpenChange={setConnecting} onCreated={onSelect} />
      <PortfolioDrawer
        open={!!renaming}
        onOpenChange={(open) => !open && setRenaming(undefined)}
        portfolio={renaming}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(undefined)}>
        <AlertDialogContent size="sm" className="gap-6 p-6">
          <AlertDialogTitle className="text-sm font-normal text-muted-foreground">
            {deleting?.source === 'monobank' ? 'Disconnect' : 'Delete'}{' '}
            <span className="text-foreground">{deleting?.name}</span> and{' '}
            {deleting?.source === 'monobank' ? 'remove its synced entries' : 'all its entries'}?
          </AlertDialogTitle>
          <AlertDialogFooter className="-mx-6 -mb-6 px-6 py-4">
            <AlertDialogCancel variant="secondary">Cancel</AlertDialogCancel>
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
              {deleting?.source === 'monobank' ? 'Disconnect' : 'Delete'}
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
          className="flex min-h-30 w-[calc(100vw-4rem)] shrink-0 flex-col justify-between rounded-xl border bg-card p-5 sm:min-h-26 sm:w-48"
        >
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="mt-4 h-6 w-28 sm:h-5" />
        </div>
      ))}
    </div>
  )
}

type CardProps = Valuation & {
  id: string
  /** Portfolio cards can be dragged; Net worth stays first. */
  sortable?: boolean
  label: string
  /** Shown on hover, e.g. when a synced card was last updated. */
  hint?: string
  entries: Entry[]
  active: boolean
  onSelect: () => void
  menu?: React.ReactNode
  live?: PriceStatus
}

const dayBefore = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)

function Card({ id, sortable, label, hint, entries, prices, daily, currency, range, active, onSelect, menu, live }: CardProps) {
  const drag = useSortable({ id, disabled: !sortable })
  const points = useMemo(() => series(entries, daily, prices, currency), [entries, daily, prices, currency])
  const today = new Date().toISOString().slice(0, 10)
  // Up to today the live balance; a period that ended earlier shows that day's close.
  const now = balance(entries, prices, currency)
  const total = range.to >= today ? now.total : valueOn(points, range.to)
  const pricing = range.to >= today && now.pricing
  const change = range.from ? total - valueOn(points, dayBefore(range.from)) : undefined

  return (
    <div
      ref={sortable ? drag.setNodeRef : undefined}
      {...(sortable ? drag.listeners : {})}
      data-slide={id}
      style={sortable ? { transform: DndCSS.Translate.toString(drag.transform), transition: drag.transition } : undefined}
      className={cn(
        'relative w-[calc(100vw-4rem)] shrink-0 snap-center snap-always touch-manipulation sm:w-48',
        drag.isDragging && 'z-10 opacity-80',
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={onSelect}
        title={hint}
        className={cn(
          'flex min-h-30 w-full flex-col justify-between rounded-xl border bg-card p-5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-26',
          active ? 'border-foreground/30 bg-accent' : 'hover:border-foreground/15',
          drag.isDragging && 'cursor-grabbing shadow-lg',
        )}
      >
        <span className="flex items-center gap-2 pr-6 text-sm text-muted-foreground">
          <span className="truncate">{label}</span>
          {live && <LiveDot status={live} />}
        </span>
        <span className="mt-4 flex flex-col gap-0.5 font-mono tabular-nums">
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span className={cn('text-2xl transition-opacity sm:text-xl', pricing && 'opacity-50')}>{formatMoney(total)}</span>
            <span className="text-xs text-muted-foreground">{currency}</span>
          </span>
          {change !== undefined && (
            <span className="text-xs text-muted-foreground">
              {change < 0 ? '−' : '+'}
              {formatMoney(Math.abs(change))}
            </span>
          )}
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
