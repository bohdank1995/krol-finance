import { useState } from 'react'
import { Field } from '@/components/field'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetBar,
  SheetClose,
  SheetContent,
  SheetFooter,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { assetsFor, typeOf, type AssetSymbol, type EntryType } from '@/lib/assets'
import { addEntry, updateEntry, type Entry, type Portfolio } from '@/lib/entries'
import { dayToIso, parseAmount } from '@/lib/format'
import { resolveAmount } from '@/lib/calc'
import { useT } from '@/lib/i18n'
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
  const t = useT()
  const type: EntryType = entry ? typeOf(entry.asset) : (chosen ?? 'money')
  // The amount field holds the size; the button that opened the drawer decides the sign.
  const direction: Direction = entry ? (entry.amount.startsWith('-') ? 'out' : 'in') : picked
  const [amount, setAmount] = useState(entry?.amount.replace(/^-/, '') ?? '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [asset, setAsset] = useState<AssetSymbol>(() => entry?.asset ?? assetsFor(type)[0].symbol)
  const [day, setDay] = useState(() => new Date(entry?.createdAt ?? Date.now()).toLocaleDateString('en-CA'))
  const [target, setTarget] = useState(entry?.portfolioId ?? portfolioId ?? portfolios[0]?.id)
  // A calculation ("15+190") counts as its result.
  const size = parseAmount(resolveAmount(amount))?.replace(/^[+-]/, '')
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

  // In the phones' top bar (small) and the wider screens' footer.
  const action = (size?: 'sm') => (
    <Button type="submit" size={size} disabled={!valid}>
      {entry ? t.save : direction === 'out' ? t.withdraw : t.deposit}
    </Button>
  )

  return (
    <form onSubmit={submit} className="contents">
      <SheetBar title={t.entryTitle(direction, type, !!entry)} action={action('sm')} cancel={t.cancel} />

      <AmountFields amount={amount} onAmountChange={setAmount} type={type} asset={asset} onAssetChange={setAsset} autoFocus />

      <div className="flex flex-wrap items-center gap-x-2 gap-y-6">
        {/* Fills its row: the whole width inside a source (no source picker) or when the picker wraps below it. */}
        <DateField value={day} onChange={setDay} className="w-auto min-w-40 flex-1" />
        {!portfolioId && (
          <Field label={t.portfolio} className="min-w-40 flex-1">
            <Select
              value={target}
              onValueChange={(v) => v && setTarget(v)}
              items={portfolios.map((p) => ({ value: p.id, label: p.name }))}
            >
              <SelectTrigger aria-label={t.portfolio} className="w-full">
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
          </Field>
        )}
      </div>

      <Field label={t.note}>
        <Textarea
          autoComplete="off"
          maxLength={200}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      <SheetFooter>
        <SheetClose render={<Button type="button" variant="secondary" />}>{t.cancel}</SheetClose>
        {action()}
      </SheetFooter>
    </form>
  )
}
