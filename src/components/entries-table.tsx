import { useState } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
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
import { assetLabel, type AssetSymbol } from '@/lib/assets'
import { deleteEntry, isReadOnly, type Entry, type Portfolio } from '@/lib/entries'
import { formatAmount, formatDate, formatSigned, formatMoney } from '@/lib/format'
import { useT } from '@/lib/i18n'
import type { Currency } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import { EntryActions } from './add-entry-menu'
import { EntryDrawer } from './entry-drawer'

type Props = {
  entries: Entry[]
  portfolios: Portfolio[]
  prices: Partial<Record<AssetSymbol, number>>
  /** Set when a single portfolio is selected; unset on Net worth (all portfolios). */
  portfolioId?: string
  currency: Currency
  /** Fake numbers mode: nothing can be added, edited or deleted. */
  readOnly: boolean
  /** A period other than All time is picked (changes the empty-state text). */
  filtered: boolean
}

const head = 'h-10 text-xs font-normal text-faint-foreground'

export function EntriesTable({ entries, portfolios, prices, portfolioId, currency, readOnly, filtered }: Props) {
  const t = useT()
  const [editing, setEditing] = useState<Entry>()
  const [deleting, setDeleting] = useState<Entry>()
  const byId = new Map(portfolios.map((h) => [h.id, h]))
  // Synced (Monobank) portfolios are read-only: no Deposit/Withdraw into them, no row edits.
  const editable = readOnly ? [] : portfolios.filter((p) => !isReadOnly(p))
  const current = portfolioId ? byId.get(portfolioId) : undefined
  const synced = isReadOnly(current)
  const rows = [...entries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  return (
    <section className="grid gap-2">
      {editable.length > 0 && !synced && <EntryActions portfolios={editable} portfolioId={portfolioId} />}

      {rows.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            {portfolios.length === 0
              ? t.empty.noPortfolios
              : filtered
                ? t.empty.period
                : current?.source === 'ibkr'
                  ? t.empty.noStocks
                  : synced
                    ? t.empty.noTransactions
                    : t.empty.noEntries}
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(head, 'hidden pl-0 sm:table-cell')}>{t.date}</TableHead>
              {!portfolioId && <TableHead className={cn(head, 'hidden sm:table-cell')}>{t.portfolio}</TableHead>}
              <TableHead className={cn(head, 'max-sm:pl-0 sm:text-right')}>{t.amount}</TableHead>
              <TableHead className={cn(head, 'hidden pl-6 sm:table-cell')}>{t.note}</TableHead>
              <TableHead className={cn(head, 'hidden text-right sm:table-cell')}>{currency}</TableHead>
              <TableHead className={cn(head, 'w-10 pr-0')} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => {
              const asset = prices[e.asset]
              const rate = prices[currency]
              const price = asset === undefined || rate === undefined ? undefined : asset / rate
              return (
                <TableRow key={e.id} className="group">
                  <TableCell className="hidden py-3.5 pl-0 font-mono whitespace-pre text-muted-foreground tabular-nums sm:table-cell">
                    {formatDate(e.createdAt)}
                  </TableCell>
                  {!portfolioId && (
                    <TableCell className="hidden py-3.5 text-muted-foreground sm:table-cell">
                      {byId.get(e.portfolioId)?.name}
                    </TableCell>
                  )}
                  <TableCell
                    className={cn(
                      'py-3.5 font-mono tabular-nums max-sm:pl-0 sm:text-right',
                      Number(e.amount) < 0 && 'text-muted-foreground',
                    )}
                  >
                    {formatSigned(e.amount)}
                    <span className="ml-2 inline-block min-w-[4ch] text-left text-muted-foreground">{assetLabel(e.asset)}</span>
                    {/* Phones have no Date column: the date sits under the amount. */}
                    <span className="mt-1 block whitespace-pre-wrap text-muted-foreground sm:hidden">
                      {formatDate(e.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell
                    title={e.note}
                    className="hidden max-w-56 truncate py-3.5 pl-6 text-muted-foreground sm:table-cell"
                  >
                    {e.note}
                  </TableCell>
                  <TableCell className="hidden py-3.5 text-right font-mono text-muted-foreground tabular-nums sm:table-cell">
                    {price === undefined ? '···' : formatMoney(Number(e.amount) * price)}
                  </TableCell>
                  <TableCell className="py-3.5 pr-0 text-right">
                    {!readOnly && !isReadOnly(byId.get(e.portfolioId)) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t.rowActions}
                              className="text-faint-foreground group-hover:text-foreground aria-expanded:text-foreground"
                            />
                          }
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onClick={() => setEditing(e)}>
                            <Pencil className="text-muted-foreground" />
                            {t.edit}
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(e)}>
                            <Trash2 />
                            {t.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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
        portfolios={editable}
        portfolioId={portfolioId}
        entry={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(undefined)}>
        <AlertDialogContent size="sm" className="gap-6 p-6">
          <AlertDialogTitle className="text-sm font-normal text-muted-foreground">
            {t.confirmDeleteEntry[0]}{' '}
            <span className="font-mono text-foreground">
              {deleting && `${formatAmount(deleting.amount)} ${assetLabel(deleting.asset)}`}
            </span>
            {t.confirmDeleteEntry[1]}
          </AlertDialogTitle>
          <AlertDialogFooter className="-mx-6 -mb-6 px-6 py-4">
            <AlertDialogCancel variant="secondary">{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleting) deleteEntry(deleting.id)
                setDeleting(undefined)
              }}
            >
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

/** Placeholder rows while entries load, laid out like the real table. */
export function EntriesTableSkeleton() {
  const t = useT()
  return (
    <Table aria-busy="true" aria-label={t.loadingEntries}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(head, 'hidden pl-0 sm:table-cell')}>{t.date}</TableHead>
          <TableHead className={cn(head, 'max-sm:pl-0 sm:text-right')}>{t.amount}</TableHead>
          <TableHead className={cn(head, 'hidden pl-6 sm:table-cell')}>{t.note}</TableHead>
          <TableHead className={cn(head, 'hidden text-right sm:table-cell')}>USD</TableHead>
          <TableHead className={cn(head, 'w-10 pr-0')} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {[0, 1, 2, 3, 4].map((i) => (
          <TableRow key={i} className="hover:bg-transparent">
            <TableCell className="hidden py-3.5 pl-0 sm:table-cell">
              <Skeleton className="h-4 w-24" />
            </TableCell>
            <TableCell className="py-3.5 max-sm:pl-0">
              <Skeleton className="h-4 w-28 sm:ml-auto" />
              <Skeleton className="mt-2 h-4 w-36 sm:hidden" />
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
