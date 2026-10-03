import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CRYPTO_ASSETS, type CryptoSymbol } from '@/lib/assets'
import { addEntry, updateEntry, type Entry } from '@/lib/entries'
import { parseAmount } from '@/lib/format'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this entry instead of adding a new one. */
  entry?: Entry
}

export function CryptoDialog({ open, onOpenChange, entry }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-6 p-6 sm:max-w-md">
        {/* Remount per open so the form starts from the right values each time. */}
        {open && <CryptoForm entry={entry} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function CryptoForm({ entry, onDone }: { entry?: Entry; onDone: () => void }) {
  const [amount, setAmount] = useState(entry?.amount ?? '')
  const [asset, setAsset] = useState<CryptoSymbol>(entry?.asset ?? 'BTC')
  const parsed = parseAmount(amount)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!parsed) return
    if (entry) updateEntry(entry.id, asset, parsed)
    else addEntry(asset, parsed)
    onDone()
  }

  return (
    <form onSubmit={submit} className="contents">
      <DialogTitle className="text-sm font-normal text-muted-foreground">
        {entry ? 'Edit crypto' : 'Crypto'}
      </DialogTitle>

      <div className="flex items-center gap-2">
        <Input
          autoFocus
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          aria-label="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          className="h-12 flex-1 font-mono text-xl tabular-nums md:text-xl"
        />
        <Select value={asset} onValueChange={(v) => v && setAsset(v as CryptoSymbol)}>
          <SelectTrigger aria-label="Asset" className="h-12! w-28 font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRYPTO_ASSETS.map((a) => (
              <SelectItem key={a.symbol} value={a.symbol}>
                <span className="w-12 font-mono">{a.symbol}</span>
                <span className="text-faint-foreground">{a.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DialogFooter className="-mx-6 -mb-6 px-6 py-4">
        <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
        <Button type="submit" disabled={!parsed} className="min-w-20">
          {entry ? 'Save' : 'Add'}
        </Button>
      </DialogFooter>
    </form>
  )
}
