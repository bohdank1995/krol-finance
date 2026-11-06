import { memo, useState } from 'react'
import { MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ASSETS, assetLabel, currencySign, isStock, type AssetSymbol, type StockSymbol } from '@/lib/assets'
import { deleteEntry, isReadOnly, removeStock, type Entry, type Portfolio } from '@/lib/entries'
import { changeTone, formatAmount, formatDate, formatSigned, formatMoney } from '@/lib/format'
import { useT } from '@/lib/i18n'
import type { Currency } from '@/lib/preferences'
import { cn } from '@/lib/utils'
import { EntryActions } from './add-entry-menu'
import { EntryDrawer } from './entry-drawer'
import { Marquee } from './marquee'

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
  /** Changes when another source or period is picked: the list goes back to its first page. */
  view: string
}

/** "Bitcoin" for BTC, in the app's language where it has its own name; stocks show their ticker. */
const assetName = (a: AssetSymbol, names: Record<string, string>) =>
  names[a] ?? ASSETS.find((x) => x.symbol === a)?.name ?? assetLabel(a)

const head = 'h-10 text-xs font-normal text-faint-foreground'
/** Fades in after the cards and the graph on page load. */
const enter = { animationDelay: '380ms' }

/** Rows drawn at first, and added by each "Show more": long histories (years of card payments) stay quick. */
const PAGE = 50

export const EntriesTable = memo(function EntriesTable({ entries, portfolios, prices, portfolioId, currency, readOnly, filtered, view }: Props) {
  const t = useT()
  const [editing, setEditing] = useState<Entry>()
  const [deleting, setDeleting] = useState<Entry>()
  const [removing, setRemoving] = useState<{ portfolioId: string; asset: StockSymbol }>()
  const [limit, setLimit] = useState({ view, rows: PAGE })
  if (limit.view !== view) setLimit({ view, rows: PAGE })
  const byId = new Map(portfolios.map((h) => [h.id, h]))
  // Synced (Monobank) portfolios are read-only: no Deposit/Withdraw into them, no row edits.
  const editable = readOnly ? [] : portfolios.filter((p) => !isReadOnly(p))
  const current = portfolioId ? byId.get(portfolioId) : undefined
  const synced = isReadOnly(current)
  // Every view with stocks has a Paid column; rows whose price IBKR didn't give show a dash.
  const showPaid = entries.some((e) => isStock(e.asset))
  const rows = [...entries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const shown = rows.slice(0, limit.rows)
  const left = rows.length - shown.length

  return (
    <section className="grid gap-2">
      {editable.length > 0 && !synced && <EntryActions portfolios={editable} portfolioId={portfolioId} />}

      {rows.length === 0 && (
        <div className="animate-enter flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-14 text-center" style={enter}>
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
        <Table className="animate-enter" style={enter}>
          <TableHeader className="max-sm:hidden">
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(head, 'hidden pl-0 sm:table-cell')}>{t.date}</TableHead>
              {!portfolioId && <TableHead className={cn(head, 'hidden sm:table-cell')}>{t.portfolio}</TableHead>}
              <TableHead className={cn(head, 'text-right')}>{t.amount}</TableHead>
              <TableHead className={cn(head, 'hidden pl-6 sm:table-cell')}>{t.note}</TableHead>
              {showPaid && <TableHead className={cn(head, 'hidden text-right sm:table-cell')}>{t.paid}</TableHead>}
              <TableHead className={cn(head, 'hidden text-right sm:table-cell')}>{currencySign(currency)}</TableHead>
              <TableHead className={cn(head, 'w-10 pr-0')} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((e) => {
              const asset = prices[e.asset]
              const rate = prices[currency]
              const price = asset === undefined || rate === undefined ? undefined : asset / rate
              return (
                <TableRow key={e.id} className="group">
                  {/* Phones: one cell like a bank app, the label (fading and sliding when long) and date on the
                      left, the amount on the right. The amount and the ⋯ always stay in full view. */}
                  <TableCell className="w-full max-w-0 py-3 pl-0 sm:hidden">
                    <span className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <Marquee>{e.note || (!portfolioId && byId.get(e.portfolioId)?.name) || assetName(e.asset, t.assetNames)}</Marquee>
                        <span className="mt-0.5 block font-mono text-xs whitespace-pre text-muted-foreground tabular-nums">
                          {formatDate(e.createdAt)}
                        </span>
                      </span>
                      <span className={cn('shrink-0 font-mono tabular-nums', changeTone(Number(e.amount)))}>
                        {formatSigned(e.amount)}
                        <span className="ml-1.5 text-muted-foreground">{assetLabel(e.asset)}</span>
                      </span>
                    </span>
                  </TableCell>
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
                      'hidden py-3.5 text-right font-mono tabular-nums sm:table-cell',
                      changeTone(Number(e.amount)),
                    )}
                  >
                    {formatSigned(e.amount)}
                    <span className="ml-2 inline-block min-w-[4ch] text-left text-muted-foreground">{assetLabel(e.asset)}</span>
                  </TableCell>
                  <TableCell
                    title={e.note}
                    className="hidden max-w-56 truncate py-3.5 pl-6 text-muted-foreground sm:table-cell"
                  >
                    {e.note}
                  </TableCell>
                  {showPaid && (
                    <TableCell className="hidden py-3.5 text-right font-mono text-muted-foreground tabular-nums sm:table-cell">
                      {!isStock(e.asset) || Number(e.amount) < 0 ? '' : e.price === undefined || rate === undefined ? '—' : formatMoney((Number(e.amount) * e.price) / rate)}
                    </TableCell>
                  )}
                  <TableCell className="hidden py-3.5 text-right font-mono text-muted-foreground tabular-nums sm:table-cell">
                    {price === undefined ? '···' : formatMoney(Number(e.amount) * price)}
                  </TableCell>
                  <TableCell className="py-3.5 pr-0 text-right">
                    {!readOnly && (!isReadOnly(byId.get(e.portfolioId)) || (byId.get(e.portfolioId)?.source === 'ibkr' && isStock(e.asset))) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="secondary"
                              size="icon"
                              aria-label={t.rowActions}
                              className="text-muted-foreground hover:text-foreground aria-expanded:text-foreground"
                            />
                          }
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        {/* IBKR rows can't be edited, but a whole stock can be removed from the portfolio. */}
                        {isReadOnly(byId.get(e.portfolioId)) ? (
                          <DropdownMenuContent align="end" className="w-60">
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setRemoving({ portfolioId: e.portfolioId, asset: e.asset as StockSymbol })}
                            >
                              <X />
                              {t.removeStock}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        ) : (
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => setEditing(e)}>
                              <Pencil className="text-muted-foreground" />
                              {t.edit}
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(e)}>
                              <Trash2 />
                              {t.delete}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        )}
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {left > 0 && (
        <Button
          variant="secondary"
          className="mt-2 h-12 w-full sm:mx-auto sm:w-fit sm:px-6"
          onClick={() => setLimit({ view, rows: limit.rows + PAGE })}
        >
          {t.showMore(Math.min(PAGE, left))}
          <span className="font-mono text-muted-foreground tabular-nums">{t.left(left)}</span>
        </Button>
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

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(undefined)}>
        <AlertDialogContent size="sm" className="gap-6 p-6">
          <AlertDialogTitle className="text-sm font-normal text-muted-foreground">
            {t.confirmRemoveStock[0]}{' '}
            <span className="font-mono text-foreground">{removing && assetLabel(removing.asset)}</span>{' '}
            {t.confirmRemoveStock[1]}
          </AlertDialogTitle>
          <AlertDialogFooter className="-mx-6 -mb-6 px-6 py-4">
            <AlertDialogCancel variant="secondary">{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removing) removeStock(removing.portfolioId, removing.asset)
                setRemoving(undefined)
              }}
            >
              {t.removeStock}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
})

