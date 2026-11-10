import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { ArrowDown, ArrowUp, ChartPie, CircleMinus, CirclePlus, MoreHorizontal, Pencil, Percent, Plus, RefreshCw, Settings2, Trash2, Ungroup, Unlink, WalletCards } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { currencySign, type AssetSymbol } from '@/lib/assets'
import {
  deletePortfolio,
  isReadOnly,
  netWorthEntries,
  refreshIbkr,
  rowItems,
  saveLayout,
  scaleEntries,
  setInNetWorth,
  type Entry,
  type Group,
  type Portfolio,
  type RowItem,
} from '@/lib/entries'
import { changeTone, formatAgo, formatMoney } from '@/lib/format'
import type { DailyPrices } from '@/lib/history'
import { useT } from '@/lib/i18n'
import type { Range } from '@/lib/period'
import { balance, series, valueOn } from '@/lib/portfolio'
import type { Currency } from '@/lib/preferences'
import type { PriceStatus } from '@/lib/prices'
import { cn } from '@/lib/utils'
import { GroupIcon } from '@/components/group-icon'
import monobankLogo from '@/assets/monobank.svg'
import ibkrLogo from '@/assets/ibkr.svg'
import { FAB, FAB_BAR } from './add-entry-menu'
import { EditCards } from './edit-cards'
import { DragPreview, DropLine, Reorder, useDragged, useDropSide } from './reorder'
import { IbkrDrawer } from './ibkr-drawer'
import { MonobankDrawer } from './monobank-drawer'
import { PercentsDrawer } from './percents-drawer'
import { PortfolioDrawer } from './portfolio-drawer'
import { Decode, Scrambling } from './scramble'

export const NET_WORTH = 'all'

// Below `sm` the row is a one-card-per-screen carousel: swiping selects the card.
const MOBILE = '(width < 40rem)'

/** A new IBKR card's first sync is loading its purchase history. Given up after 15 minutes, in case that sync never finished. */
const loadingHistory = (p: Portfolio) =>
  !!p.loadingHistory && Date.now() - Date.parse(p.createdAt) < 15 * 60_000

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
  groups: Group[]
  entries: Entry[]
  status: PriceStatus
  selected: string
  onSelect: (id: string) => void
  /** Fake numbers mode: no renaming, deleting or dragging. */
  readOnly: boolean
  /** Sits above the cards, left of the "+" on phones (the edit button and period picker). */
  toolbar?: ReactNode
  /** The edit mode (`edit-cards.tsx`) shows instead of the row. */
  editing?: boolean
  /** Opens the edit mode; unset hides its button. */
  onEdit?: () => void
  onEditingDone?: () => void
}

export const PortfolioCards = memo(function PortfolioCards({ portfolios, groups, entries, status, selected, onSelect, readOnly, toolbar, editing, onEdit, onEditingDone, ...valuation }: Props) {
  const t = useT()
  const [creating, setCreating] = useState(false)
  const [syncing, setSyncing] = useState<string[]>([])
  const [syncStatus, setSyncStatus] = useState<Record<string, string>>({})
  const [connecting, setConnecting] = useState<'monobank' | 'ibkr'>()
  const [renaming, setRenaming] = useState<Portfolio>()
  const [deleting, setDeleting] = useState<Portfolio>()
  const [adjusting, setAdjusting] = useState<Portfolio>()
  const [renamingGroup, setRenamingGroup] = useState<Group>()
  const [openGroup, setOpenGroup] = useState<string>()
  const rowRef = useRef<HTMLDivElement>(null)
  const latest = useRef({ selected, onSelect })
  useEffect(() => {
    latest.current = { selected, onSelect }
  })
  const counted = useMemo(
    () => scaleEntries(portfolios, netWorthEntries(portfolios, entries), 'netWorth'),
    [portfolios, entries],
  )
  // Kept between renders: each card's graph maths only reruns when its entries really change.
  const scaled = useMemo(
    () => new Map(portfolios.map((h) => [h.id, scaleEntries([h], entries.filter((e) => e.portfolioId === h.id), 'card')])),
    [portfolios, entries],
  )
  /** "Sync now": shows progress and the result in the card's hint line, then goes back to "Synced …". */
  const syncIbkr = async (id: string) => {
    const show = (text?: string) =>
      setSyncStatus((all) => {
        const { [id]: _, ...rest } = all
        return text ? { ...rest, [id]: text } : rest
      })
    setSyncing((ids) => [...ids, id])
    show(t.ibkr.syncing)
    try {
      await refreshIbkr()
      show(t.ibkr.updated)
    } catch (e) {
      show(e instanceof Error ? e.message : t.ibkr.unreachable)
    }
    setSyncing((ids) => ids.filter((i) => i !== id))
    setTimeout(() => show(), 5000)
  }
  const ownEntries = (id: string) => entries.filter((e) => e.portfolioId === id)

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
    // The row is drawn anew after the edit mode closes.
  }, [editing])

  // Selecting another way (dot, new or deleted portfolio) brings that card into view: centred on
  // phones; on wider screens only when it's (partly) out of view, just far enough to show it whole.
  useEffect(() => {
    const row = rowRef.current
    const el = row?.querySelector<HTMLElement>(`[data-slide="${CSS.escape(selected)}"]`)
    if (!row || !el) return
    if (matchMedia(MOBILE).matches) {
      if (centredSlide(row) !== selected)
        row.scrollTo({ left: el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
      return
    }
    // The row's padding keeps cards clear of the screen edge and of the "+" pinned on the right.
    const { paddingLeft, paddingRight } = getComputedStyle(row)
    const start = row.scrollLeft + parseFloat(paddingLeft)
    const end = row.scrollLeft + row.clientWidth - parseFloat(paddingRight)
    if (el.offsetLeft < start) row.scrollTo({ left: el.offsetLeft - parseFloat(paddingLeft), behavior: 'smooth' })
    else if (el.offsetLeft + el.offsetWidth > end)
      row.scrollTo({ left: el.offsetLeft + el.offsetWidth - row.clientWidth + parseFloat(paddingRight), behavior: 'smooth' })
  }, [selected, portfolios.length])

  // An opened group's sources unfold to its right: once they have (300 ms), scroll just far enough to show
  // them all. Wider screens only: on phones a scroll picks the card it settles on.
  useEffect(() => {
    const row = rowRef.current
    if (!row || !openGroup || matchMedia(MOBILE).matches) return
    const timer = window.setTimeout(() => {
      const ids = portfolios.filter((p) => p.groupId === openGroup).map((p) => p.id)
      const last = row.querySelector<HTMLElement>(`[data-slide="${CSS.escape(ids[ids.length - 1] ?? '')}"]`)
      if (!last) return
      const end = row.scrollLeft + row.clientWidth - parseFloat(getComputedStyle(row).paddingRight)
      if (last.offsetLeft + last.offsetWidth > end)
        row.scrollTo({ left: last.offsetLeft + last.offsetWidth - row.clientWidth + parseFloat(getComputedStyle(row).paddingRight), behavior: 'smooth' })
    }, 320)
    return () => window.clearTimeout(timer)
  }, [openGroup, portfolios])

  // Cards fade in one after another, left to right.
  let order = 0
  const items = rowItems(portfolios, groups)
  /** Renames a group or changes its icon, or turns its sources back into single sources where it was (like edit mode does). */
  const editGroup = (id: string, name: string, icon: string | undefined) =>
    saveLayout(items.map((i) => (i.kind === 'group' && i.group.id === id ? { ...i, group: { ...i.group, name, icon } } : i)))
  const ungroup = (id: string) => {
    if (selected === id) onSelect(NET_WORTH)
    saveLayout(
      items.flatMap((i): RowItem[] =>
        i.kind === 'group' && i.group.id === id ? i.members.map((portfolio) => ({ kind: 'source', portfolio })) : [i],
      ),
    )
  }
  /** A group is open while it, or one of its sources, is picked. */
  const isOpen = (item: Extract<RowItem, { kind: 'group' }>) =>
    openGroup === item.group.id || item.members.some((m) => m.id === selected)
  /** The card following the pointer while one is dragged into a new place. */
  const preview = (id: string) => {
    const group = items.find((i) => i.kind === 'group' && i.group.id === id)
    const list = group?.kind === 'group' ? group.members : portfolios.filter((p) => p.id === id)
    const total = list.reduce((sum, p) => sum + balance(scaled.get(p.id) ?? [], valuation.prices, valuation.currency).total, 0)
    const label = group?.kind === 'group' ? group.group.name : list[0]?.name ?? ''
    return <DragPreview label={label} value={`${formatMoney(total)} ${currencySign(valuation.currency)}`} className="max-sm:w-[calc(100vw-3rem)]" />
  }
  // The phones' dots: one per card in the row, open groups' sources included.
  const slides = [
    { id: NET_WORTH, label: t.netWorth },
    ...items.flatMap((i) =>
      i.kind === 'source'
        ? [{ id: i.portfolio.id, label: i.portfolio.name }]
        : [{ id: i.group.id, label: i.group.name }, ...(isOpen(i) ? i.members.map((m) => ({ id: m.id, label: m.name })) : [])],
    ),
  ]
  /** A source's card; `folded` ones belong to a closed group: no width, slid in behind it. */
  const sourceCard = (h: Portfolio, folded = false) => (
    <Card
      key={h.id}
      id={h.id}
      draggable={!readOnly && !folded}
      folded={folded}
      order={++order}
      label={h.name}
      hidden={!h.inNetWorth}
      share={h.cardPercent / 100}
      netWorthShare={h.inNetWorth ? h.netWorthPercent : undefined}
      syncing={syncing.includes(h.id) || loadingHistory(h)}
      message={syncStatus[h.id]}
      hint={syncStatus[h.id] ?? (loadingHistory(h) ? t.ibkr.loadingHistory : h.syncedAt && t.synced(formatAgo(h.syncedAt)))}
      entries={scaled.get(h.id) ?? []}
      {...valuation}
      active={selected === h.id}
      onSelect={() => onSelect(h.id)}
      menu={
        !readOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={t.portfolioActions(h.name)}
                  className="absolute top-3 right-3 text-muted-foreground hover:text-foreground aria-expanded:text-foreground"
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuItem onClick={() => setRenaming(h)}>
                <Pencil className="text-muted-foreground" />
                {t.rename}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAdjusting(h)}>
                <Percent className="text-muted-foreground" />
                {t.setPercentages}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setInNetWorth(h.id, !h.inNetWorth)}>
                {h.inNetWorth ? <CircleMinus className="text-muted-foreground" /> : <CirclePlus className="text-muted-foreground" />}
                {h.inNetWorth ? t.hideFromNetWorth : t.showInNetWorth}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(h)}>
                {isReadOnly(h) ? <Unlink /> : <Trash2 />}
                {isReadOnly(h) ? t.disconnect : t.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    />
  )

  /** "+" menu: in the toolbar next to the period on phones, pinned to the right of the cards on wider screens. */
  const addMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            aria-label={t.addPortfolio}
            style={{ animationDelay: `${(portfolios.length + 1) * 60}ms` }}
            className="animate-enter pointer-events-auto text-muted-foreground shadow-sm hover:text-foreground aria-expanded:text-foreground"
          />
        }
      >
        <Plus />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={() => setCreating(true)}>
          <WalletCards className="text-muted-foreground" />
          {t.custom}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setConnecting('monobank')}>
          <BrandIcon src={monobankLogo} />
          Monobank
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setConnecting('ibkr')}>
          <BrandIcon src={ibkrLogo} />
          Interactive Brokers
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  if (editing)
    return (
      <EditCards
        portfolios={portfolios}
        groups={groups}
        entries={entries}
        prices={valuation.prices}
        currency={valuation.currency}
        onDone={() => onEditingDone?.()}
      />
    )

  return (
    <div className="animate-in duration-300 fade-in">
      {/* Same edges as the cards and everything below them. */}
      <div className="mb-3 flex items-center gap-2">
        <span className="mr-auto">{toolbar}</span>
        {onEdit && (
          <Button
            variant="outline"
            size="icon-lg"
            aria-label={t.editSources}
            onClick={onEdit}
            className="text-muted-foreground hover:text-foreground"
          >
            <Settings2 />
          </Button>
        )}
        <span className="sm:hidden">{addMenu}</span>
      </div>
      <Reorder items={items} onMove={saveLayout} preview={preview}>
        <div className="relative">
          <div
            ref={rowRef}
            role="tablist"
            aria-label={t.portfolios}
            className="relative -mx-6 flex snap-x snap-mandatory gap-2 overflow-x-auto px-6 pt-1.5 pb-2 max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden sm:snap-none sm:gap-3 sm:pr-24"
          >
            <Card
              id={NET_WORTH}
              order={0}
              label={t.netWorth}
              entries={counted}
              {...valuation}
              active={selected === NET_WORTH}
              onSelect={() => onSelect(NET_WORTH)}
              live={entries.length > 0 ? status : undefined}
            />
            {items.map((item) =>
              item.kind === 'source' ? (
                sourceCard(item.portfolio)
              ) : (
                // An outline around the group's card, and its sources while it's open. An outline rather than
                // a border, so it takes no room and the cards keep their place and size.
                <div
                  key={item.group.id}
                  className="mx-1.5 flex shrink-0 gap-2 rounded-xl outline-1 outline-offset-4 outline-foreground/15 outline-solid sm:gap-3"
                >
                  <Card
                    id={item.group.id}
                    draggable={!readOnly}
                    order={++order}
                    label={item.group.name}
                    icon={item.group.icon}
                    stack={!isOpen(item)}
                    note={t.sourcesCount(item.members.length)}
                    entries={item.members.flatMap((m) => scaled.get(m.id) ?? [])}
                    {...valuation}
                    active={selected === item.group.id}
                    onSelect={() => {
                      // Opens the group (its sources slide out to the right); a second click closes it.
                      if (selected === item.group.id) setOpenGroup(openGroup === item.group.id ? undefined : item.group.id)
                      else setOpenGroup(item.group.id)
                      onSelect(item.group.id)
                    }}
                    menu={
                      !readOnly && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="secondary"
                                size="icon"
                                aria-label={t.groupActions(item.group.name)}
                                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground aria-expanded:text-foreground"
                              />
                            }
                          >
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => setRenamingGroup(item.group)}>
                              <Pencil className="text-muted-foreground" />
                              {t.rename}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => ungroup(item.group.id)}>
                              <Ungroup className="text-muted-foreground" />
                              {t.ungroup}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )
                    }
                  />
                  {item.members.map((m) => sourceCard(m, !isOpen(item)))}
                </div>
              ),
            )}
          </div>

          {/* Pinned to the right over a fade: stays put while the cards scroll underneath. */}
          <div className="pointer-events-none absolute inset-y-0 -right-6 flex w-16 max-sm:hidden items-center justify-end bg-linear-to-l from-background via-background/80 to-transparent pr-0.5 pb-2 sm:w-28 sm:pr-6">
            {addMenu}
          </div>
        </div>
      </Reorder>

      {slides.length > 1 && (
        <div className="mt-2 flex justify-center sm:hidden">
          {slides.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-label={t.showCard(s.label)}
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

      {/* IBKR card picked: a floating "Sync now" where Deposit / Withdraw sit for other cards, styled like Withdraw. */}
      {!readOnly && portfolios.find((p) => p.id === selected)?.source === 'ibkr' && (
        <div className={FAB_BAR}>
          <Button variant="secondary" disabled={syncing.includes(selected)} onClick={() => syncIbkr(selected)} className={FAB}>
            <RefreshCw className={cn(syncing.includes(selected) && 'animate-spin')} />
            {syncing.includes(selected) ? t.ibkr.syncing : t.ibkr.syncNow}
          </Button>
        </div>
      )}

      <PortfolioDrawer open={creating} onOpenChange={setCreating} onCreated={onSelect} />
      <MonobankDrawer
        open={connecting === 'monobank'}
        onOpenChange={(open) => !open && setConnecting(undefined)}
        onCreated={onSelect}
      />
      <IbkrDrawer
        open={connecting === 'ibkr'}
        onOpenChange={(open) => !open && setConnecting(undefined)}
        onCreated={onSelect}
      />
      <PortfolioDrawer
        open={!!renamingGroup}
        onOpenChange={(open) => !open && setRenamingGroup(undefined)}
        group={renamingGroup && { name: renamingGroup.name, icon: renamingGroup.icon, onSave: (name, icon) => editGroup(renamingGroup.id, name, icon) }}
      />
      <PortfolioDrawer
        open={!!renaming}
        onOpenChange={(open) => !open && setRenaming(undefined)}
        portfolio={renaming}
      />

      <PercentsDrawer
        portfolio={adjusting}
        onOpenChange={(open) => !open && setAdjusting(undefined)}
        total={adjusting ? balance(ownEntries(adjusting.id), valuation.prices, valuation.currency).total : 0}
        currency={valuation.currency}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(undefined)}>
        <AlertDialogContent size="sm" className="gap-6 p-6">
          <AlertDialogTitle className="text-sm font-normal text-muted-foreground">
            {t.confirmDeletePortfolio(isReadOnly(deleting))[0]}{' '}
            <span className="text-foreground">{deleting?.name}</span>{' '}
            {t.confirmDeletePortfolio(isReadOnly(deleting))[1]}
          </AlertDialogTitle>
          <AlertDialogFooter className="-mx-6 -mb-6 px-6 py-4">
            <AlertDialogCancel variant="secondary">{t.cancel}</AlertDialogCancel>
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
              {isReadOnly(deleting) ? t.disconnect : t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
})

type CardProps = Valuation & {
  id: string
  /** Place in the row: the cards fade in one after another, left to right. */
  order: number
  label: string
  /** A group's icon (`group-icon.tsx`), shown left of the label. */
  icon?: string
  /** A group's card: true draws two cards peeking out on its right (closed), false tucks them away (open). */
  stack?: boolean
  /** A short grey line under the label, e.g. "3 sources" on a group. */
  note?: string
  /** A source of a closed group: folded away to no width (it unfolds when the group opens). */
  folded?: boolean
  /** Can be dragged to a new place (and dropped next to). Not Net worth, not in Fake numbers. */
  draggable?: boolean
  /** Left out of the Net worth total. */
  hidden?: boolean
  /** Part of the real balance the card shows (0–1); the entries passed in are already scaled. */
  share?: number
  /** Percent counted in Net worth, when below 100. */
  netWorthShare?: number
  /** Shown on hover, e.g. when a synced card was last updated. */
  hint?: string
  /** "Sync now" is running: the numbers show as a skeleton. */
  syncing?: boolean
  /** Result of the last "Sync now", shown on the card for a few seconds. */
  message?: string
  entries: Entry[]
  active: boolean
  onSelect: () => void
  menu?: React.ReactNode
  live?: PriceStatus
}

const dayBefore = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)

function Card({ id, order, label, icon, stack, note, folded, draggable = false, hidden, share = 1, netWorthShare, hint, syncing, message, entries, prices, daily, currency, range, active, onSelect, menu, live }: CardProps) {
  const t = useT()
  const points = useMemo(() => series(entries, daily, prices, currency), [entries, daily, prices, currency])
  const today = new Date().toISOString().slice(0, 10)
  // Up to today the live balance; a period that ended earlier shows that day's close.
  const now = balance(entries, prices, currency)
  const total = range.to >= today ? now.total : valueOn(points, range.to)
  const pricing = range.to >= today && now.pricing
  const change = range.from ? total - valueOn(points, dayBefore(range.from)) : undefined
  const drag = useDraggable({ id, disabled: !draggable })
  const drop = useDroppable({ id, disabled: !draggable })
  const side = useDropSide(id)
  const dragged = useDragged() === id

  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el)
        drop.setNodeRef(el)
      }}
      {...(draggable ? drag.listeners : {})}
      data-slide={folded ? undefined : id}
      inert={folded}
      style={{ animationDelay: `${order * 60}ms` }}
      className={cn(
        'animate-enter relative w-[calc(100vw-3rem)] shrink-0 snap-center snap-always touch-manipulation transition-[width,opacity,margin] duration-300 ease-out sm:w-62',
        // Folded: no width and the row's gap taken back, so it slides out from behind its group. Not a
        // stop for the swipe either, or a swipe could settle between the group and the next card.
        folded && 'pointer-events-none -ml-2 w-0 snap-align-none overflow-hidden opacity-0 sm:-ml-3 sm:w-0',
        // The card being dragged stays in place, faded, while its copy follows the pointer.
        dragged && 'opacity-40',
        // Room for the stacked cards on the right, inside the group's outline.
        stack && 'mr-3',
      )}
    >
      <DropLine side={side} />
      {/* A closed group: two cards behind it, each a little shorter and further right, with a soft shadow. */}
      {stack !== undefined &&
        [12, 6].map((offset) => (
          <span
            key={offset}
            aria-hidden
            style={{ insetBlock: offset / 2 + 2, translate: stack ? `${offset}px 0` : '0 0' }}
            className={cn(
              'pointer-events-none absolute right-0 left-4 rounded-xl border bg-card shadow-[4px_0_8px_-2px_rgb(0_0_0/0.5)] transition-[translate,opacity] duration-300 ease-out',
              !stack && 'opacity-0',
            )}
          />
        ))}
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={onSelect}
        title={hint}
        className={cn(
          'relative flex h-full min-h-30 w-full flex-col justify-between rounded-xl border bg-card p-5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-26',
          // Keeps its full width while folded (the outer box shrinks), so the text never rewraps and stretches the row.
          'min-w-[calc(100vw-3rem)] sm:min-w-62',
          active ? 'border-foreground/30 bg-accent' : 'hover:border-foreground/15',
        )}
      >
        <span className="flex items-center gap-2 pr-10 text-sm text-muted-foreground">
          <GroupIcon icon={icon} />
          <span className="truncate">{label}</span>
          {note && <span className="shrink-0 text-xs text-faint-foreground">{note}</span>}
          {syncing ? <RefreshCw className="size-3.5 shrink-0 animate-spin" /> : live && <LiveDot status={live} />}
          {hidden && (
            <Hint text={t.hiddenFromNetWorth}>
              <CircleMinus className="size-3.5" aria-label={t.hiddenFromNetWorth} />
            </Hint>
          )}
          {netWorthShare !== undefined && netWorthShare < 100 && (
            <Hint text={t.countsInNetWorth(netWorthShare)}>
              <ChartPie className="size-3.5" aria-label={t.countsInNetWorth(netWorthShare)} />
            </Hint>
          )}
        </span>
        {syncing ? (
          <span aria-busy="true" aria-label={message} className="mt-4 flex items-baseline gap-x-1.5 font-mono tabular-nums">
            <Scrambling length={formatMoney(total).length} className="text-2xl text-faint-foreground sm:text-xl" />
            <span className="text-xs text-muted-foreground">{currencySign(currency)}</span>
          </span>
        ) : (
        <span className="mt-4 flex flex-col gap-0.5 font-mono tabular-nums">
          {message && <span className="font-sans text-xs text-brand">{message}</span>}
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span className={cn('text-2xl transition-opacity sm:text-xl', pricing && 'opacity-50')}>
              <Decode text={formatMoney(total)} />
            </span>
            <span className="text-xs text-muted-foreground">{currencySign(currency)}</span>
          </span>
          {share !== 1 && (
            <span className="text-xs text-faint-foreground">
              {t.shareOf(Math.round(share * 1000) / 10, formatMoney(total / share))}
            </span>
          )}
          {/* Change during the period: gains in green with an arrow up, losses stay muted with an arrow down. */}
          {change !== undefined && (
            <span className={cn('flex items-center gap-0.5 text-xs', changeTone(change))}>
              {change < 0 ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
              <Decode text={formatMoney(Math.abs(change))} />
            </span>
          )}
        </span>
        )}
      </button>
      {menu}
    </div>
  )
}

/** A small icon on a card with its explanation in a tooltip. A span, since it sits inside the card's button. */
function Hint({ text, children }: { text: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="shrink-0 text-faint-foreground" />}>{children}</TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

/** A company logo drawn in the menu's grey, like the lucide icons next to it (the SVG is used as a mask). */
function BrandIcon({ src }: { src: string }) {
  return (
    <span
      aria-hidden
      className="size-4 shrink-0 bg-muted-foreground mask-contain mask-center mask-no-repeat"
      style={{ maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")` }}
    />
  )
}

function LiveDot({ status }: { status: PriceStatus }) {
  const t = useT()
  const live = status === 'live'
  return (
    <span className="relative flex size-2 shrink-0" title={live ? t.live : t.reconnecting}>
      {live && <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-40" />}
      <span className={cn('relative size-2 rounded-full', live ? 'bg-brand' : 'bg-faint-foreground')} />
    </span>
  )
}
