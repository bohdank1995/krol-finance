import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetTitle } from '@/components/ui/sheet'
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

/** Right-side drawer: how much of a portfolio its card shows and Net worth counts. */
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
  const [card, setCard] = useState(String(portfolio.cardPercent))
  const [netWorth, setNetWorth] = useState(String(portfolio.netWorthPercent))
  const cardValue = parse(card)
  const netWorthValue = parse(netWorth)
  const cardValid = cardValue > 0 && cardValue <= 100
  const netWorthValid = netWorthValue >= 0 && netWorthValue <= 100

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cardValid || !netWorthValid) return
    setPercents(portfolio.id, cardValue, netWorthValue)
    onDone()
  }

  return (
    <form onSubmit={submit} className="contents">
      <SheetTitle className="text-sm font-normal text-muted-foreground">
        {t.percentages} · <span className="text-foreground">{portfolio.name}</span>
      </SheetTitle>

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
          autoFocus
        />
        <Field
          label={t.countsInNetWorthLabel}
          value={netWorth}
          onChange={setNetWorth}
          valid={netWorthValid}
          error={t.netWorthPercentError}
          result={netWorthValid ? (total * netWorthValue) / 100 : undefined}
          total={total}
          currency={currency}
          note={!portfolio.inNetWorth ? t.hiddenNote : undefined}
        />
      </div>

      <SheetFooter>
        <SheetClose render={<Button type="button" variant="secondary" />}>{t.cancel}</SheetClose>
        <Button type="submit" disabled={!cardValid || !netWorthValid}>
          {t.save}
        </Button>
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
    <label className="flex flex-col gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
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
