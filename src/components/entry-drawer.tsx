import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet'
import { assetsFor, ENTRY_TYPES, typeOf, type AssetSymbol, type EntryType } from '@/lib/assets'
import { addEntry, updateEntry, type Entry, type Portfolio } from '@/lib/entries'
import { dayToIso, parseAmount } from '@/lib/format'
import { AmountFields, DateField } from './amount-fields'

export type Direction = 'in' | 'out'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  portfolios: Portfolio[]
  /** Adding inside a specific portfolio. Leave unset (Net worth view) to show a portfolio picker. */
  portfolioId?: string
  /** The kind of entry being added (chosen in the Add entry menu). Ignored when editing. */
  type?: EntryType
  /** Deposit (in) or withdraw (out), picked with the floating buttons. Ignored when editing. */
  direction?: Direction
  /** When set, the drawer edits this entry instead of adding a new one. */
  entry?: Entry
}

/** Right-side drawer to add or edit an entry. */
export function EntryDrawer({ open, onOpenChange, ...rest }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent showCloseButton={false}>
        {/* Remount per open so the form starts from the right values each time. */}
        {open && <EntryForm {...rest} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function EntryForm({
  portfolios,
  portfolioId,
  type: chosen,
  direction: picked = 'in',
  entry,
  onDone,
}: Omit<Props, 'open' | 'onOpenChange'> & { onDone: () => void }) {
  const type: EntryType = entry ? typeOf(entry.asset) : (chosen ?? 'money')
  const label = ENTRY_TYPES.find((t) => t.value === type)?.label.toLowerCase()
  // The amount field holds the size; the button that opened the drawer decides the sign.
  const direction: Direction = entry ? (entry.amount.startsWith('-') ? 'out' : 'in') : picked
  const verb = direction === 'out' ? 'withdrawal' : 'deposit'
  const [amount, setAmount] = useState(entry?.amount.replace(/^-/, '') ?? '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [asset, setAsset] = useState<AssetSymbol>(() => entry?.asset ?? assetsFor(type)[0].symbol)
  const [day, setDay] = useState(() => new Date(entry?.createdAt ?? Date.now()).toLocaleDateString('en-CA'))
  const [target, setTarget] = useState(entry?.portfolioId ?? portfolioId ?? portfolios[0]?.id)
  const size = parseAmount(amount)?.replace(/^[+-]/, '')
  const parsed = size && (direction === 'out' ? `-${size}` : size)
  const valid = !!parsed && !!target && !!day

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!parsed || !target) return
    const createdAt = dayToIso(day, entry?.createdAt)
    const trimmed = note.trim() || undefined
    if (entry) updateEntry(entry.id, { portfolioId: target, asset, amount: parsed, createdAt, note: trimmed })
    else addEntry(target, { asset, amount: parsed, createdAt, note: trimmed })
    onDone()
  }

  return (
    <form onSubmit={submit} className="contents">
      <SheetTitle className="text-sm font-normal text-muted-foreground">
        {entry ? `Edit ${label} ${verb}` : `${direction === 'out' ? 'Withdraw' : 'Deposit'} ${label}`}
      </SheetTitle>

      <AmountFields amount={amount} onAmountChange={setAmount} type={type} asset={asset} onAssetChange={setAsset} autoFocus />

      <div className="flex flex-wrap items-center gap-2">
        <DateField value={day} onChange={setDay} />
        {!portfolioId && (
          <Select
            value={target}
            onValueChange={(v) => v && setTarget(v)}
            items={portfolios.map((p) => ({ value: p.id, label: p.name }))}
          >
            <SelectTrigger aria-label="Portfolio" className="h-10! min-w-40 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {portfolios.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Input
        placeholder="Note"
        aria-label="Note"
        autoComplete="off"
        maxLength={200}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="h-10"
      />

      <SheetFooter>
        <SheetClose render={<Button type="button" variant="secondary" />}>Cancel</SheetClose>
        <Button type="submit" disabled={!valid}>
          {entry ? 'Save' : direction === 'out' ? 'Withdraw' : 'Deposit'}
        </Button>
      </SheetFooter>
    </form>
  )
}
