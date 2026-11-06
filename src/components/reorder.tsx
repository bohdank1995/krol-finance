import { createContext, useContext, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragMoveEvent,
} from '@dnd-kit/core'
import type { RowItem } from '@/lib/entries'
import { ROOT, isGroupId, locate, moveItem, type Spot } from '@/lib/layout'
import { cn } from '@/lib/utils'

/* Dragging cards into a new order, in the dashboard row and in edit mode. Cards don't shuffle while
   dragging: a green line shows where the card will land, and it moves there on release. Cards register
   as drop targets by their id; a group's block in edit mode by "group:<id>" (dropping on it adds to it). */

type Side = 'before' | 'after' | 'above' | 'below' | 'inside'
type Target = { over: string; side: Side; spot: Spot }

const Context = createContext<{ active?: string; target?: Target }>({})

/** The id being dragged, if any. */
export const useDragged = () => useContext(Context).active
/** Where the line goes on this drop target, if the dragged card would land next to (or into) it. */
export const useDropSide = (id: string) => {
  const { target } = useContext(Context)
  return target?.over === id ? target.side : undefined
}

const BLOCK = 'group:'

/** Which drop target the dragged card is over, and on which side of it it would land. */
function aim(items: RowItem[], dragged: string, over: string, left: boolean, top: boolean): Target | undefined {
  if (over === dragged) return
  const draggingGroup = isGroupId(items, dragged)
  if (over.startsWith(BLOCK)) {
    const group = over.slice(BLOCK.length)
    if (group === dragged) return
    const at = locate(items, group)
    if (!at) return
    if (!draggingGroup) {
      const item = items[at.index]
      return { over, side: 'inside', spot: { container: group, index: item.kind === 'group' ? item.members.length : 0 } }
    }
    return { over, side: top ? 'above' : 'below', spot: { container: ROOT, index: at.index + (top ? 0 : 1) } }
  }
  const at = locate(items, over)
  if (!at || (draggingGroup && at.container !== ROOT)) return
  return { over, side: left ? 'before' : 'after', spot: { container: at.container, index: at.index + (left ? 0 : 1) } }
}

export function Reorder({
  items,
  onMove,
  preview,
  children,
}: {
  items: RowItem[]
  /** Called on release with the new order. */
  onMove: (next: RowItem[]) => void
  /** What follows the pointer while dragging. */
  preview: (id: string) => ReactNode
  children: ReactNode
}) {
  const [active, setActive] = useState<string>()
  const [target, setTarget] = useState<Target>()
  // Mouse: drag after moving a few pixels, so a click still selects. Touch: long-press, so a swipe still scrolls.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  // The card under the pointer wins over the group block around it. A dragged group only lands next to
  // cards in the row (not inside another group). In a gap, the nearest target counts.
  const collide: CollisionDetection = (args) => {
    const draggingGroup = isGroupId(items, String(args.active.id))
    const allowed = args.droppableContainers.filter((c) => {
      const id = String(c.id)
      if (id === String(args.active.id) || id.startsWith(BLOCK)) return true
      return !draggingGroup || locate(items, id)?.container === ROOT
    })
    const hits = pointerWithin({ ...args, droppableContainers: allowed })
    const cards = hits.filter((h) => !String(h.id).startsWith(BLOCK))
    if (cards.length) return cards
    if (hits.length) return hits
    // Measured from the pointer, not the dragged card: a dragged group is as wide as the screen.
    const at = args.pointerCoordinates
    const collisionRect = at ? { top: at.y, left: at.x, bottom: at.y, right: at.x, width: 0, height: 0 } : args.collisionRect
    return closestCenter({ ...args, collisionRect, droppableContainers: allowed.filter((c) => !String(c.id).startsWith(BLOCK)) })
  }

  // Which half of the target the pointer is over decides the side.
  const move = ({ active, over, activatorEvent, delta }: DragMoveEvent) => {
    const start = 'touches' in activatorEvent ? (activatorEvent as TouchEvent).touches[0] : (activatorEvent as MouseEvent)
    if (!over || !start) return setTarget(undefined)
    const x = start.clientX + delta.x
    const y = start.clientY + delta.y
    setTarget(aim(items, String(active.id), String(over.id), x < over.rect.left + over.rect.width / 2, y < over.rect.top + over.rect.height / 2))
  }
  const reset = () => {
    setActive(undefined)
    setTarget(undefined)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collide}
      onDragStart={(e) => setActive(String(e.active.id))}
      onDragMove={move}
      onDragEnd={() => {
        if (active && target) onMove(moveItem(items, active, target.spot))
        reset()
      }}
      onDragCancel={reset}
    >
      <Context.Provider value={{ active, target }}>{children}</Context.Provider>
      <DragOverlay dropAnimation={null}>{active ? preview(active) : null}</DragOverlay>
    </DndContext>
  )
}

/** The green line where a dragged card would land. Goes inside the target, which must be `relative`. */
export function DropLine({ side }: { side?: Side }) {
  if (!side) return null
  if (side === 'inside') return <span aria-hidden className="pointer-events-none absolute inset-0 z-10 rounded-xl ring-2 ring-brand" />
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute z-10 rounded-full bg-brand',
        // Centred in the gap between cards (gap-2 on phones, gap-3 wider).
        side === 'before' && 'inset-y-2 -left-[5px] w-0.5 sm:-left-[7px]',
        side === 'after' && 'inset-y-2 -right-[5px] w-0.5 sm:-right-[7px]',
        side === 'above' && 'inset-x-2 -top-[7px] h-0.5',
        side === 'below' && 'inset-x-2 -bottom-[7px] h-0.5',
      )}
    />
  )
}

/** A card following the pointer while dragging. */
export function DragPreview({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('flex min-h-26 w-62 rotate-2 cursor-grabbing flex-col justify-between rounded-xl border border-foreground/30 bg-accent p-5 shadow-xl', className)}>
      <span className="truncate text-sm text-muted-foreground">{label}</span>
      <span className="mt-3 truncate font-mono text-xl tabular-nums">{value}</span>
    </div>
  )
}
