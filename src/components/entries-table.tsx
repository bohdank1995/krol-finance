import { useState } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AssetSymbol } from '@/lib/assets'
import { deleteEntry, type Entry, type Portfolio } from '@/lib/entries'
import { formatAmount, formatDate, formatSigned, formatUsd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { AddEntryButton, AddEntryMenu } from './add-entry-menu'
import { EntryDrawer } from './entry-drawer'

type Props = {
  entries: Entry[]
  portfolios: Portfolio[]
  prices: Partial<Record<AssetSymbol, number>>
  /** Set when a single portfolio is selected; unset on Net worth (all portfolios). */
  portfolioId?: string
}

const head = 'h-10 text-xs font-normal text-faint-foreground'

export function EntriesTable({ entries, portfolios, prices, portfolioId }: Props) {
  const [editing, setEditing] = useState<Entry>()
  const [deleting, setDeleting] = useState<Entry>()
  const names = new Map(portfolios.map((h) => [h.id, h.name]))
  const rows = [...entries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  return (
    <section className="grid gap-2">
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-14 text-center">
          {portfolios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create your first portfolio with the + card above.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">No entries yet. Add the first one to see a balance.</p>
              <AddEntryButton portfolios={portfolios} portfolioId={portfolioId} />
            </>
          )}
        </div>
      ) : (
        <AddEntryMenu
          portfolios={portfolios}
          portfolioId={portfolioId}
          trigger={
            <Button
              size="icon-lg"
              aria-label="Add entry"
              className="fixed right-6 bottom-6 z-40 size-14 rounded-full shadow-lg [&_svg]:size-6"
            >
              <Plus />
            </Button>
          }
        />
      )}

      {rows.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(head, 'pl-0')}>Date</TableHead>
              {!portfolioId && <TableHead className={cn(head, 'hidden sm:table-cell')}>Portfolio</TableHead>}
              <TableHead className={cn(head, 'text-right')}>Amount</TableHead>
              <TableHead className={cn(head, 'hidden pl-6 sm:table-cell')}>Note</TableHead>
              <TableHead className={cn(head, 'hidden text-right sm:table-cell')}>USD</TableHead>
              <TableHead className={cn(head, 'w-10 pr-0')} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => {
              const price = prices[e.asset]
              return (
                <TableRow key={e.id} className="group">
                  <TableCell className="py-3.5 pl-0 font-mono whitespace-pre text-muted-foreground tabular-nums">
                    {formatDate(e.createdAt)}
                  </TableCell>
                  {!portfolioId && (
                    <TableCell className="hidden py-3.5 text-muted-foreground sm:table-cell">
                      {names.get(e.portfolioId)}
                    </TableCell>
                  )}
                  <TableCell
                    className={cn(
                      'py-3.5 text-right font-mono tabular-nums',
                      Number(e.amount) < 0 && 'text-muted-foreground',
                    )}
                  >
                    {formatSigned(e.amount)}
                    <span className="ml-2 inline-block w-10 text-left text-muted-foreground">{e.asset}</span>
                  </TableCell>
                  <TableCell
                    title={e.note}
                    className="hidden max-w-56 truncate py-3.5 pl-6 text-muted-foreground sm:table-cell"
                  >
                    {e.note}
                  </TableCell>
                  <TableCell className="hidden py-3.5 text-right font-mono text-muted-foreground tabular-nums sm:table-cell">
                    {price === undefined ? '···' : formatUsd(Number(e.amount) * price)}
                  </TableCell>
                  <TableCell className="py-3.5 pr-0 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Row actions"
                            className="text-faint-foreground group-hover:text-foreground aria-expanded:text-foreground"
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => setEditing(e)}>
                          <Pencil className="text-muted-foreground" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleting(e)}>
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <EntryDrawer
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(undefined)}
        portfolios={portfolios}
        portfolioId={portfolioId}
        entry={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(undefined)}>
        <AlertDialogContent size="sm" className="gap-6 p-6">
          <AlertDialogTitle className="text-sm font-normal text-muted-foreground">
            Delete{' '}
            <span className="font-mono text-foreground">
              {deleting && `${formatAmount(deleting.amount)} ${deleting.asset}`}
            </span>
            ?
          </AlertDialogTitle>
          <AlertDialogFooter className="-mx-6 -mb-6 px-6 py-4">
            <AlertDialogCancel variant="ghost">Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleting) deleteEntry(deleting.id)
                setDeleting(undefined)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

/** Placeholder rows while entries load, laid out like the real table. */
export function EntriesTableSkeleton() {
  return (
    <Table aria-busy="true" aria-label="Loading entries">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(head, 'pl-0')}>Date</TableHead>
          <TableHead className={cn(head, 'text-right')}>Amount</TableHead>
          <TableHead className={cn(head, 'hidden pl-6 sm:table-cell')}>Note</TableHead>
          <TableHead className={cn(head, 'hidden text-right sm:table-cell')}>USD</TableHead>
          <TableHead className={cn(head, 'w-10 pr-0')} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {[0, 1, 2, 3, 4].map((i) => (
          <TableRow key={i} className="hover:bg-transparent">
            <TableCell className="py-3.5 pl-0">
              <Skeleton className="h-4 w-24" />
            </TableCell>
            <TableCell className="py-3.5">
              <Skeleton className="ml-auto h-4 w-28" />
            </TableCell>
            <TableCell className="hidden py-3.5 pl-6 sm:table-cell">
              <Skeleton className={cn('h-4', i % 2 ? 'w-16' : 'w-32')} />
            </TableCell>
            <TableCell className="hidden py-3.5 sm:table-cell">
              <Skeleton className="ml-auto h-4 w-20" />
            </TableCell>
            <TableCell className="py-3.5 pr-0">
              <div className="size-7" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
