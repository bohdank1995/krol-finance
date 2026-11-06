import type { RowItem } from './entries'

/* Moving cards around the row: the rules shared by the dashboard row and the edit mode. A place in
   the row is a container (the row itself, or a group) plus an index in it. */

/** The row itself, as opposed to a group's id. */
export const ROOT = 'root'

export type Spot = { container: string; index: number }

/** The id a row item is dragged by: a source's or a group's. */
export const itemId = (i: RowItem) => (i.kind === 'source' ? i.portfolio.id : i.group.id)

export const isGroupId = (items: RowItem[], id: string) => items.some((i) => i.kind === 'group' && i.group.id === id)

/** Where a source or group sits: in the row, or inside a group. */
export function locate(items: RowItem[], id: string): Spot | undefined {
  const top = items.findIndex((i) => itemId(i) === id)
  if (top >= 0) return { container: ROOT, index: top }
  for (const i of items) {
    if (i.kind !== 'group') continue
    const at = i.members.findIndex((m) => m.id === id)
    if (at >= 0) return { container: i.group.id, index: at }
  }
}

/** A group needs 2 sources: one left becomes a single source again (like Ungroup), none and it's gone. */
export function tidy(items: RowItem[]): RowItem[] {
  return items.flatMap((i): RowItem[] => {
    if (i.kind === 'source' || i.members.length >= 2) return [i]
    return i.members.map((portfolio) => ({ kind: 'source', portfolio }))
  })
}

/** Moves a source or a group to `to`. Groups only move within the row; sources can go in and out of groups. */
export function moveItem(items: RowItem[], id: string, to: Spot): RowItem[] {
  const from = locate(items, id)
  if (!from) return items
  // Taking it out first shifts what follows in the same container by one.
  const index = from.container === to.container && from.index < to.index ? to.index - 1 : to.index
  if (from.container === to.container && from.index === index) return items

  if (isGroupId(items, id)) {
    if (to.container !== ROOT) return items
    const next = [...items]
    const [group] = next.splice(from.index, 1)
    next.splice(index, 0, group)
    return next
  }

  let moved: RowItem | undefined
  const without = items.flatMap((i): RowItem[] => {
    if (i.kind === 'source') {
      if (i.portfolio.id !== id) return [i]
      moved = i
      return []
    }
    const member = i.members.find((m) => m.id === id)
    if (!member) return [i]
    moved = { kind: 'source', portfolio: member }
    return [{ ...i, members: i.members.filter((m) => m.id !== id) }]
  })
  if (!moved || moved.kind !== 'source') return items
  const portfolio = moved.portfolio
  if (to.container === ROOT) {
    without.splice(index, 0, moved)
    return tidy(without)
  }
  return tidy(
    without.map((i) => {
      if (i.kind !== 'group' || i.group.id !== to.container) return i
      const members = [...i.members]
      members.splice(index, 0, portfolio)
      return { ...i, members }
    }),
  )
}
