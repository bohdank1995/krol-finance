import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/field'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetBar,
  SheetClose,
  SheetContent,
  SheetFooter,
} from '@/components/ui/sheet'
import { connectMonobankCards, listMonobankCards, type MonobankCard } from '@/lib/entries'
import { formatAmount } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { cn, masked, noAutofill } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (id: string) => void
}

/** Right-side drawer to connect Monobank cards: paste the token, then tick one or more. */
export function MonobankDrawer({ open, onOpenChange, onCreated }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent showCloseButton={false}>
        {/* Remount per open so the flow starts from the token step each time. */}
        {open && <MonobankFlow onCreated={onCreated} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

const TYPES: Record<string, string> = {
  black: 'Black',
  white: 'White',
  platinum: 'Platinum',
  iron: 'Iron',
  fop: 'FOP',
  yellow: 'Yellow',
  eAid: 'єПідтримка',
  madeInUkraine: 'Made in Ukraine',
}

const cardLabel = (c: MonobankCard) =>
  [TYPES[c.type] ?? c.type, c.asset && c.asset !== 'UAH' ? c.asset : '', c.last4 && `•• ${c.last4}`]
    .filter(Boolean)
    .join(' ')

/** Cards that can be added come first, already added ones last; Monobank's own order changes between visits. */
const rank = (c: MonobankCard) => (c.connected ? 2 : c.asset ? 0 : 1)
const sorted = (cards: MonobankCard[]) =>
  [...cards].sort((a, b) => rank(a) - rank(b) || cardLabel(a).localeCompare(cardLabel(b)))

function MonobankFlow({ onCreated, onDone }: { onCreated?: (id: string) => void; onDone: () => void }) {
  const t = useT()
  const [token, setToken] = useState('')
  const [cards, setCards] = useState<MonobankCard[]>()
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  // The server keeps the token after the first time, so ask it for the cards before showing the token step.
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let live = true
    listMonobankCards()
      .then((found) => live && found && setCards(found))
      .catch(() => {})
      .finally(() => live && setChecking(false))
    return () => {
      live = false
    }
  }, [])

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    setError(undefined)
    try {
      await task()
    } catch (e) {
      setError(e instanceof Error ? e.message : t.somethingWrong)
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!cards) {
      if (token.trim()) run(async () => setCards((await listMonobankCards(token.trim())) ?? []))
    } else if (picked.size) {
      run(async () => {
        const chosen = cards.filter((c) => picked.has(c.id))
        const [first] = await connectMonobankCards(chosen.map((c) => ({ accountId: c.id, name: `Mono ${cardLabel(c)}` })))
        if (first) onCreated?.(first)
        onDone()
      })
    }
  }

  const toggle = (id: string, on: boolean) =>
    setPicked((s) => {
      const next = new Set(s)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  if (checking)
    return (
      <>
        <SheetBar title={t.monobank.connect} cancel={t.cancel} />
        <Loader2 className="animate-spin text-muted-foreground" />
      </>
    )

  const valid = cards ? picked.size > 0 : !!token.trim()
  const action = (size?: 'sm') => (
    <Button type="submit" size={size} disabled={!valid || busy}>
      {busy && <Loader2 className="animate-spin" />}
      {cards ? t.connect : t.continue}
      {cards && picked.size > 1 && <span className="font-mono tabular-nums">{picked.size}</span>}
    </Button>
  )

  return (
    <form onSubmit={submit} className="contents">
      <SheetBar title={cards ? t.monobank.pickCards : t.monobank.connect} action={action('sm')} cancel={t.cancel} />

      {!cards ? (
        <div className="grid gap-3">
          <p className="text-muted-foreground">
            {t.monobank.intro[0]}{' '}
            <a
              href="https://api.monobank.ua"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              api.monobank.ua
            </a>
            {t.monobank.intro[1]}
          </p>
          <Field label={t.token}>
            <Input
              autoFocus
              {...noAutofill}
              aria-label={t.monobank.tokenLabel}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className={cn('h-12 font-mono', masked)}
            />
          </Field>
        </div>
      ) : (
        <div className="grid gap-4">
          {cards.length === 0 && <p className="text-muted-foreground">{t.monobank.noCards}</p>}
          <div role="group" aria-label={t.monobank.cards} className="grid gap-2">
            {sorted(cards).map((c) => {
              const disabled = c.connected || !c.asset
              const on = picked.has(c.id)
              return (
                <label
                  key={c.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                    on ? 'border-foreground/30 bg-accent' : 'hover:border-foreground/15',
                    disabled && 'pointer-events-none opacity-50',
                  )}
                >
                  <Checkbox checked={on} disabled={disabled} onCheckedChange={(v) => toggle(c.id, v)} />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span>{cardLabel(c)}</span>
                    {disabled && (
                      <span className="text-xs text-faint-foreground">
                        {c.connected ? t.alreadyConnected : t.monobank.currencyNotSupported}
                      </span>
                    )}
                  </span>
                  <span className="font-mono whitespace-nowrap tabular-nums">
                    {formatAmount(c.balance)}
                    <span className="ml-1.5 text-xs text-muted-foreground">{c.asset ?? '—'}</span>
                  </span>
                </label>
              )
            })}
          </div>

          {picked.size > 1 && <p className="text-xs text-faint-foreground">{t.monobank.historyNote}</p>}
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}

      <SheetFooter>
        <SheetClose render={<Button type="button" variant="secondary" />}>{t.cancel}</SheetClose>
        {action()}
      </SheetFooter>
    </form>
  )
}
