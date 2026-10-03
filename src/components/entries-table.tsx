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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { deleteEntry, type Entry } from '@/lib/entries'
import { formatAmount, formatDate } from '@/lib/format'
import { CryptoDialog } from './crypto-dialog'

export function EntriesTable({ entries }: { entries: Entry[] }) {
  const [editing, setEditing] = useState<Entry>()
  const [deleting, setDeleting] = useState<Entry>()

  if (entries.length === 0) return null

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="hidden h-10 pl-0 text-xs sm:table-cell font-normal text-faint-foreground">Type</TableHead>
            <TableHead className="h-10 pl-0 text-right text-xs font-normal text-faint-foreground sm:pl-2">Amount</TableHead>
            <TableHead className="h-10 text-right text-xs font-normal text-faint-foreground">Date</TableHead>
            <TableHead className="h-10 w-10 pr-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id} className="group">
              <TableCell className="hidden py-3.5 pl-0 text-muted-foreground sm:table-cell">Crypto</TableCell>
              <TableCell className="py-3.5 pl-0 text-right font-mono tabular-nums sm:pl-2">
                {formatAmount(e.amount)}
                <span className="ml-2 inline-block w-10 text-left text-muted-foreground">{e.asset}</span>
              </TableCell>
              <TableCell className="py-3.5 text-right font-mono whitespace-pre text-muted-foreground tabular-nums">
                {formatDate(e.createdAt)}
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
          ))}
        </TableBody>
      </Table>

      <CryptoDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(undefined)}
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
    </>
  )
}
