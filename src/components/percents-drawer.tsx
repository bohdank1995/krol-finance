import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetBar, SheetClose, SheetContent, SheetFooter } from '@/components/ui/sheet'
import { currencySign } from '@/lib/assets'
import { setPercents, type Portfolio } from '@/lib/entries'
import { formatMoney } from '@/lib/format'
import { useT } from '@/lib/i18n'
import type { Currency } from '@/lib/preferences'

type Props = {
  /** Open while set. */
  portfolio?: Portfolio
  onOpenChange: (open: boolean) => void
  /** The portfolio's real balance now, in `currency`, to preview what each percentage gives. */
  total: number
  currency: Currency
}

/** Right-side drawer: your share of a portfolio, used by its card and by Net worth. */
export function PercentsDrawer({ portfolio, onOpenChange, ...rest }: Props) {
  return (
    <Sheet open={!!portfolio} onOpenChange={onOpenChange}>
      <SheetContent showCloseButton={false}>
        {/* Remount per open so the fields start from the saved values. */}
        {portfolio && <PercentsForm portfolio={portfolio} {...rest} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

const parse = (text: string) => (text.trim() === '' ? NaN : Number(text.replace(',', '.')))

function PercentsForm({
  portfolio,
  total,
  currency,
  onDone,
}: Omit<Props, 'portfolio' | 'onOpenChange'> & { portfolio: Portfolio; onDone: () => void }) {
  const t = useT()
  // One share for both the source's own card and Net worth.
  const [card, setCard] = useState(String(portfolio.cardPercent))
  const cardValue = parse(card)
  const cardValid = cardValue > 0 && cardValue <= 100

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cardValid) return
    setPercents(portfolio.id, cardValue, cardValue)
    onDone()
  }

  const action = (size?: 'sm') => (
    <Button type="submit" size={size} disabled={!cardValid}>
      {t.save}
    </Button>
  )

  return (
    <form onSubmit={submit} className="contents">
      <SheetBar
        title={
          <>
            {t.percentages} · <span className="text-foreground">{portfolio.name}</span>
          </>
        }
        action={action('sm')}
        cancel={t.cancel}
      />

      <div className="flex flex-col gap-6">
        <Field
          label={t.cardShows}
          value={card}
          onChange={setCard}
          valid={cardValid}
          error={t.cardPercentError}
          result={cardValid ? (total * cardValue) / 100 : undefined}
          total={total}
          currency={currency}
          note={!portfolio.inNetWorth ? t.hiddenNote : undefined}
          autoFocus
        />
      </div>

      <SheetFooter>
        <SheetClose render={<Button type="button" variant="secondary" />}>{t.cancel}</SheetClose>
        {action()}
      </SheetFooter>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  valid,
  error,
  result,
  total,
  currency,
  note,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  valid: boolean
  error: string
  result?: number
  total: number
  currency: Currency
  note?: string
  autoFocus?: boolean
}) {
  const t = useT()
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="relative">
        <Input
          autoFocus={autoFocus}
          autoComplete="off"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!valid}
          className="h-12 pr-8 font-mono tabular-nums"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          %
        </span>
      </div>
      <span className="font-mono text-xs text-faint-foreground tabular-nums">
        {result === undefined ? (
          <span className="font-sans text-destructive">{error}</span>
        ) : (
          <>
            {t.partOf(formatMoney(result), formatMoney(total))} {currencySign(currency)}
          </>
        )}
      </span>
      {note && <span className="text-xs text-faint-foreground">{note}</span>}
    </label>
  )
}
