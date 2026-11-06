import { useState } from 'react'
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS as DndCSS } from '@dnd-kit/utilities'
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
import { balance } from '@/lib/portfolio'
import type { Currency } from '@/lib/preferences'
import { cn } from '@/lib/utils'

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

/** The id an item is dragged by: a source's or a group's. */
const itemId = (i: RowItem) => (i.kind === 'source' ? i.portfolio.id : i.group.id)

/** A group needs 2 sources: one left becomes a single source again, none and it's gone. */
function tidy(items: RowItem[]): RowItem[] {
  return items.flatMap((i): RowItem[] => {
    if (i.kind === 'source' || i.members.length >= 2) return [i]
    return i.members.map((portfolio) => ({ kind: 'source', portfolio }))
  })
}

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

  // Mouse: drag after moving a few pixels, so a click still ticks. Touch: long-press, so the page still scrolls.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setItems((all) => {
      const ids = all.map(itemId)
      return arrayMove(all, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    })
  }
  const onMemberDragEnd = (groupId: string) => ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setItems((all) =>
      all.map((i) => {
        if (i.kind !== 'group' || i.group.id !== groupId) return i
        const ids = i.members.map((m) => m.id)
        return { ...i, members: arrayMove(i.members, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))) }
      }),
    )
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
  const ticked = items.flatMap((i) => (i.kind === 'source' ? [i.portfolio] : i.members)).filter((p) => checked.has(p.id))

  return (
    <div className="animate-in duration-300 fade-in">
      {/* Phones: Cancel on the left, Save on the right. */}
      <div className="mb-3 flex items-center gap-2 max-sm:justify-between">
        <Button variant="secondary" onClick={onDone}>
          {t.cancel}
        </Button>
        <Button onClick={save}>{t.save}</Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map(itemId)} strategy={rectSortingStrategy}>
          {/* Wraps instead of scrolling, so every source is in view: two per row on phones. */}
          <div className="flex flex-wrap gap-x-2 gap-y-3 pt-2 sm:gap-x-3">
            {items.map((i) =>
              i.kind === 'source' ? (
                card(i.portfolio)
              ) : (
                <SortableItem key={i.group.id} id={i.group.id} className="basis-full">
                  {(handle) => (
                    <div className="grid gap-2 rounded-xl border border-dashed p-3">
                      <div className="flex items-center gap-2">
                        <button type="button" aria-label={t.group} className="cursor-grab touch-none text-faint-foreground" {...handle}>
                          <GripVertical className="size-4" />
                        </button>
                        <Input
                          aria-label={t.groupName}
                          value={i.group.name}
                          maxLength={100}
                          onChange={(e) => rename(i.group.id, e.target.value)}
                          className="h-9 w-auto max-w-64 min-w-24 border-transparent bg-transparent px-1.5 font-medium field-sizing-content hover:border-input dark:bg-transparent"
                        />
                        <span className="text-xs text-faint-foreground">{t.sourcesCount(i.members.length)}</span>
                        <Button variant="secondary" size="sm" className="ml-auto" onClick={() => ungroup(i.group.id)}>
                          {t.ungroup}
                        </Button>
                      </div>
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onMemberDragEnd(i.group.id)}>
                        <SortableContext items={i.members.map((m) => m.id)} strategy={rectSortingStrategy}>
                          <div className="flex flex-wrap gap-x-2 gap-y-3 pt-2 sm:gap-x-3">{i.members.map((m) => card(m, i))}</div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}
                </SortableItem>
              ),
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Appears once something is ticked, above where the floating buttons usually sit. */}
      {checked.size > 0 && (
        <div className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md animate-in items-center gap-2 rounded-full border bg-popover p-2 pl-5 shadow-lg duration-200 fade-in slide-in-from-bottom-4">
          <span className="mr-auto text-sm text-muted-foreground">{t.selected(checked.size)}</span>
          <Button variant="secondary" className="text-destructive" onClick={() => setConfirming(ticked)}>
            {t.delete}
          </Button>
          <Button disabled={checked.size < 2} onClick={() => setNaming(true)}>
            {t.group}
          </Button>
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

/** Something in the edit grid that can be dragged. `children` gets the drag handle's props (a group drags by its grip). */
function SortableItem({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children: (handle: ReturnType<typeof useSortable>['listeners']) => React.ReactNode
}) {
  const drag = useSortable({ id })
  return (
    <div
      ref={drag.setNodeRef}
      {...drag.attributes}
      style={{ transform: DndCSS.Translate.toString(drag.transform), transition: drag.transition }}
      className={cn('relative', drag.isDragging && 'z-10 opacity-80', className)}
    >
      {children(drag.listeners)}
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
  const drag = useSortable({ id: portfolio.id })
  // Each card starts its wiggle at a different moment, so they don't move in step.
  const delay = `-${(portfolio.id.charCodeAt(0) + portfolio.id.charCodeAt(1)) % 30}0ms`
  return (
    <div
      ref={drag.setNodeRef}
      {...drag.attributes}
      {...drag.listeners}
      style={{ transform: DndCSS.Translate.toString(drag.transform), transition: drag.transition, animationDelay: delay }}
      className={cn(
        'relative w-[calc(50%-0.25rem)] touch-manipulation sm:w-62',
        // The whole card wiggles, minus badge included.
        drag.isDragging ? 'z-10 cursor-grabbing' : 'animate-wiggle cursor-grab',
      )}
    >
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
          drag.isDragging && 'shadow-lg',
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
