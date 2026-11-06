import { useLayoutEffect, useRef, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { GripVertical, Minus } from 'lucide-react'
import { Field } from '@/components/field'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Sheet, SheetBar, SheetClose, SheetContent, SheetFooter } from '@/components/ui/sheet'
import { currencySign, type AssetSymbol } from '@/lib/assets'
import {
  deletePortfolio,
  isReadOnly,
  rowItems,
  saveLayout,
  scaleEntries,
  type Entry,
  type Group,
  type Portfolio,
  type RowItem,
} from '@/lib/entries'
import { formatMoney } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { tidy } from '@/lib/layout'
import { balance } from '@/lib/portfolio'
import type { Currency } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import { DragPreview, DropLine, Reorder, useDragged, useDropSide } from './reorder'

/* The cards' edit mode, like rearranging apps on an iPhone: every source is shown at once and wiggles,
   and they can be dragged into order, ticked to delete or group, or removed with their minus badge.
   Nothing is saved until Save; Cancel leaves everything as it was. */

type GroupItem = Extract<RowItem, { kind: 'group' }>

type Props = {
  portfolios: Portfolio[]
  groups: Group[]
  entries: Entry[]
  prices: Partial<Record<AssetSymbol, number>>
  currency: Currency
  /** Leaves edit mode (after saving, or on Cancel). */
  onDone: () => void
}

/** Fills the width: as many cards per row as fit (2 on phones), each at least 14rem wide. */
const GRID = 'grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] sm:gap-x-3'

/** Takes these sources out wherever they are (alone or in a group). */
const without = (items: RowItem[], ids: Set<string>) =>
  items.flatMap((i): RowItem[] =>
    i.kind === 'source' ? (ids.has(i.portfolio.id) ? [] : [i]) : [{ ...i, members: i.members.filter((m) => !ids.has(m.id)) }],
  )

export function EditCards({ portfolios, groups, entries, prices, currency, onDone }: Props) {
  const t = useT()
  const [items, setItems] = useState(() => rowItems(portfolios, groups))
  const [deleted, setDeleted] = useState<string[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  /** Sources waiting for the "Delete?" answer. */
  const [confirming, setConfirming] = useState<Portfolio[]>()
  const [naming, setNaming] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const columns = useColumns(gridRef)

  const totalOf = (p: Portfolio) =>
    balance(scaleEntries([p], entries.filter((e) => e.portfolioId === p.id), 'card'), prices, currency).total

  const toggle = (id: string) =>
    setChecked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const remove = (list: Portfolio[]) => {
    const ids = new Set(list.map((p) => p.id))
    setItems((all) => tidy(without(all, ids)))
    setDeleted((d) => [...d, ...ids])
    setChecked(new Set())
  }

  /** Minus on a card inside a group: the card moves out, right after its group. */
  const takeOut = (group: GroupItem, p: Portfolio) =>
    setItems((all) =>
      tidy(
        all.flatMap((i): RowItem[] =>
          i.kind === 'group' && i.group.id === group.group.id
            ? [{ ...i, members: i.members.filter((m) => m.id !== p.id) }, { kind: 'source', portfolio: p }]
            : [i],
        ),
      ),
    )

  /** The ticked sources become a group, where the first of them was. */
  const group = (name: string) => {
    const members = items.flatMap((i) => (i.kind === 'source' ? [i.portfolio] : i.members)).filter((p) => checked.has(p.id))
    const created: RowItem = { kind: 'group', group: { id: crypto.randomUUID(), name }, members }
    setItems((all) => {
      const next: RowItem[] = []
      for (const i of all) {
        const has = i.kind === 'source' ? checked.has(i.portfolio.id) : i.members.some((m) => checked.has(m.id))
        if (has && !next.includes(created)) next.push(created)
        next.push(...without([i], checked))
      }
      return tidy(next)
    })
    setChecked(new Set())
  }

  /** The group's sources become single sources again, where the group was. */
  const ungroup = (id: string) =>
    setItems((all) =>
      all.flatMap((i): RowItem[] =>
        i.kind === 'group' && i.group.id === id ? i.members.map((portfolio) => ({ kind: 'source', portfolio })) : [i],
      ),
    )

  const rename = (id: string, name: string) =>
    setItems((all) => all.map((i) => (i.kind === 'group' && i.group.id === id ? { ...i, group: { ...i.group, name } } : i)))

  const save = () => {
    for (const id of deleted) deletePortfolio(id)
    // Groups keep a name even if it was cleared.
    saveLayout(items.map((i) => (i.kind === 'group' && !i.group.name.trim() ? { ...i, group: { ...i.group, name: t.newGroup } } : i)))
    onDone()
  }

  const card = (p: Portfolio, inGroup?: GroupItem) => (
    <EditCard
      key={p.id}
      portfolio={p}
      value={`${formatMoney(totalOf(p))} ${currencySign(currency)}`}
      checked={checked.has(p.id)}
      onToggle={() => toggle(p.id)}
      minusLabel={inGroup ? t.removeFromGroup(p.name) : t.removeSource(p.name)}
      onMinus={() => (inGroup ? takeOut(inGroup, p) : setConfirming([p]))}
    />
  )
  const preview = (id: string) => {
    const item = items.find((i) => i.kind === 'group' && i.group.id === id)
    if (item?.kind === 'group')
      return <DragPreview label={item.group.name} value={t.sourcesCount(item.members.length)} />
    const p = portfolios.find((x) => x.id === id)
    return p && <DragPreview label={p.name} value={`${formatMoney(totalOf(p))} ${currencySign(currency)}`} />
  }
  const inOneGroup = items.some((i) => i.kind === 'group' && [...checked].every((id) => i.members.some((m) => m.id === id)))
  const ticked = items.flatMap((i) => (i.kind === 'source' ? [i.portfolio] : i.members)).filter((p) => checked.has(p.id))

  return (
    <div className="animate-in duration-300 fade-in">
      {/* Right side on wider screens; on phones Cancel on the left and Save on the right. */}
      <div className="mb-3 flex items-center justify-end gap-2 max-sm:justify-between">
        <Button variant="secondary" onClick={onDone}>
          {t.cancel}
        </Button>
        <Button onClick={save}>{t.save}</Button>
      </div>

      <Reorder items={items} onMove={setItems} preview={preview}>
        {/* Every source in view at once, filling the width. */}
        <div ref={gridRef} className={cn(GRID, 'pt-2')}>
          {items.map((i) =>
            i.kind === 'source' ? (
              card(i.portfolio)
            ) : (
              <GroupBlock key={i.group.id} item={i} columns={columns} onRename={rename} onUngroup={ungroup}>
                {i.members.map((m) => card(m, i))}
              </GroupBlock>
            ),
          )}
        </div>
      </Reorder>

      {/* Appears once something is ticked, above where the floating buttons usually sit. */}
      {checked.size > 0 && (
        <div className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md animate-in items-center gap-2 rounded-full border bg-popover p-2 pl-5 shadow-lg duration-200 fade-in slide-in-from-bottom-4">
          <span className="mr-auto text-sm text-muted-foreground">{t.selected(checked.size)}</span>
          <Button variant="secondary" className="text-destructive" onClick={() => setConfirming(ticked)}>
            {t.delete}
          </Button>
          {/* No group inside a group: ticking only cards of one group offers just Delete. */}
          {!inOneGroup && (
            <Button disabled={checked.size < 2} onClick={() => setNaming(true)}>
              {t.group}
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(undefined)}>
        <AlertDialogContent size="sm" className="gap-6 p-6">
          <AlertDialogTitle className="text-sm font-normal text-muted-foreground">
            {confirming?.length === 1 ? (
              <>
                {t.confirmDeletePortfolio(isReadOnly(confirming[0]))[0]}{' '}
                <span className="text-foreground">{confirming[0].name}</span>{' '}
                {t.confirmDeletePortfolio(isReadOnly(confirming[0]))[1]}
              </>
            ) : (
              t.confirmDeleteMany(confirming?.length ?? 0)
            )}
          </AlertDialogTitle>
          <AlertDialogFooter className="-mx-6 -mb-6 px-6 py-4">
            <AlertDialogCancel variant="secondary">{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirming) remove(confirming)
                setConfirming(undefined)
              }}
            >
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GroupDrawer open={naming} onOpenChange={setNaming} onCreate={group} />
    </div>
  )
}

/** How many cards fit in a row of this grid right now (it fills the width with as many as fit). */
function useColumns(ref: React.RefObject<HTMLElement | null>) {
  const [columns, setColumns] = useState(2)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setColumns(getComputedStyle(el).gridTemplateColumns.split(' ').length)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return columns
}

/** A group in edit mode: its name (editable), Ungroup, and its cards. Drags by its grip; a card dropped on
    it joins it. */
function GroupBlock({
  item,
  columns,
  onRename,
  onUngroup,
  children,
}: {
  item: GroupItem
  /** Cards per row in the grid around it: the group is as wide as its cards, up to a full row. */
  columns: number
  onRename: (id: string, name: string) => void
  onUngroup: (id: string) => void
  children: React.ReactNode
}) {
  const t = useT()
  const drag = useDraggable({ id: item.group.id })
  const drop = useDroppable({ id: `group:${item.group.id}` })
  const dragged = useDragged() === item.group.id
  const span = Math.min(item.members.length, columns)
  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el)
        drop.setNodeRef(el)
      }}
      style={{ gridColumn: `span ${span} / span ${span}` }}
      className={cn('relative grid min-w-0 gap-2 rounded-xl border border-dashed p-3 transition-opacity', dragged && 'opacity-40')}
    >
      <DropLine side={useDropSide(`group:${item.group.id}`)} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t.moveGroup(item.group.name)}
          className="cursor-grab touch-none text-faint-foreground hover:text-foreground"
          {...drag.attributes}
          {...drag.listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <Input
          aria-label={t.groupName}
          value={item.group.name}
          maxLength={100}
          onChange={(e) => onRename(item.group.id, e.target.value)}
          className="h-9 w-auto max-w-64 min-w-16 border-transparent bg-transparent px-1.5 font-medium field-sizing-content hover:border-input dark:bg-transparent"
        />
        <span className="text-xs text-faint-foreground">{t.sourcesCount(item.members.length)}</span>
        <Button variant="secondary" size="sm" className="ml-auto" onClick={() => onUngroup(item.group.id)}>
          {t.ungroup}
        </Button>
      </div>
      <div className={cn(GRID, 'pt-2')} style={{ gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))` }}>
        {children}
      </div>
    </div>
  )
}

/** A source in edit mode: wiggles, ticks on a click, drags anywhere, minus badge on its corner. */
function EditCard({
  portfolio,
  value,
  checked,
  onToggle,
  minusLabel,
  onMinus,
}: {
  portfolio: Portfolio
  value: string
  checked: boolean
  onToggle: () => void
  minusLabel: string
  onMinus: () => void
}) {
  const drag = useDraggable({ id: portfolio.id })
  const drop = useDroppable({ id: portfolio.id })
  const side = useDropSide(portfolio.id)
  const dragged = useDragged() === portfolio.id
  // Each card starts its wiggle at a different moment, so they don't move in step.
  const delay = `-${(portfolio.id.charCodeAt(0) + portfolio.id.charCodeAt(1)) % 30}0ms`
  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el)
        drop.setNodeRef(el)
      }}
      {...drag.attributes}
      {...drag.listeners}
      style={{ animationDelay: delay }}
      className={cn(
        'relative min-w-0 touch-manipulation',
        // The whole card wiggles, minus badge included. The one being dragged stays behind, faded.
        dragged ? 'opacity-40' : 'animate-wiggle cursor-grab',
      )}
    >
      <DropLine side={side} />
      <div
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            onToggle()
          }
        }}
        className={cn(
          'flex min-h-24 flex-col justify-between rounded-xl border bg-card p-4 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-26 sm:p-5',
          checked ? 'border-foreground/30 bg-accent' : 'hover:border-foreground/15',
        )}
      >
        <span className="truncate pr-6 text-sm text-muted-foreground">{portfolio.name}</span>
        <span className="mt-3 truncate font-mono text-base tabular-nums sm:text-xl">{value}</span>
        <Checkbox checked={checked} tabIndex={-1} aria-hidden className="pointer-events-none absolute top-4 right-4" />
      </div>
      <button
        type="button"
        aria-label={minusLabel}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onMinus}
        className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border bg-secondary text-foreground shadow-sm hover:bg-accent"
      >
        <Minus className="size-3.5" />
      </button>
    </div>
  )
}

function GroupDrawer({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; onCreate: (name: string) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent showCloseButton={false}>
        {open && (
          <GroupForm
            onCreate={(name) => {
              onCreate(name)
              onOpenChange(false)
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function GroupForm({ onCreate }: { onCreate: (name: string) => void }) {
  const t = useT()
  const [name, setName] = useState('')
  const valid = !!name.trim()
  const action = (size?: 'sm') => (
    <Button type="submit" size={size} disabled={!valid}>
      {t.create}
    </Button>
  )
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onCreate(name.trim())
      }}
      className="contents"
    >
      <SheetBar title={t.newGroup} action={action('sm')} cancel={t.cancel} />
      <Field label={t.groupName}>
        <Input autoFocus autoComplete="off" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="h-12" />
      </Field>
      <SheetFooter>
        <SheetClose render={<Button type="button" variant="secondary" />}>{t.cancel}</SheetClose>
        {action()}
      </SheetFooter>
    </form>
  )
}
