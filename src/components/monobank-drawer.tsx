import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet'
import { connectMonobankCard, listMonobankCards, type MonobankCard } from '@/lib/entries'
import { formatAmount } from '@/lib/format'
import { cn, masked, noAutofill } from '@/lib/utils'
import { EmojiPicker } from './emoji-picker'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (id: string) => void
}

/** Right-side drawer to connect a Monobank card: paste the token, then pick a card. */
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

function MonobankFlow({ onCreated, onDone }: { onCreated?: (id: string) => void; onDone: () => void }) {
  const [token, setToken] = useState('')
  const [cards, setCards] = useState<MonobankCard[]>()
  const [picked, setPicked] = useState<MonobankCard>()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    setError(undefined)
    try {
      await task()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!cards) {
      if (token.trim()) run(async () => setCards(await listMonobankCards(token.trim())))
    } else if (picked && name.trim()) {
      run(async () => {
        const id = await connectMonobankCard(picked.id, name.trim())
        onCreated?.(id)
        onDone()
      })
    }
  }

  const pick = (card: MonobankCard) => {
    setPicked(card)
    setName(`Mono ${cardLabel(card)}`)
  }

  const valid = cards ? !!picked && !!name.trim() : !!token.trim()

  return (
    <form onSubmit={submit} className="contents">
      <SheetTitle className="text-sm font-normal text-muted-foreground">
        {cards ? 'Pick a card' : 'Connect Monobank'}
      </SheetTitle>

      {!cards ? (
        <div className="grid gap-3">
          <p className="text-muted-foreground">
            Open{' '}
            <a
              href="https://api.monobank.ua"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              api.monobank.ua
            </a>
            , scan the QR code with the Monobank app, then paste the token here. It can only read
            balances and transactions.
          </p>
          <Input
            autoFocus
            {...noAutofill}
            placeholder="Token"
            aria-label="Monobank token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className={cn('h-12 font-mono', masked)}
          />
        </div>
      ) : (
        <div className="grid gap-4">
          {cards.length === 0 && <p className="text-muted-foreground">No cards found on this account.</p>}
          <div role="radiogroup" aria-label="Cards" className="grid gap-2">
            {cards.map((c) => {
              const disabled = c.connected || !c.asset
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={picked?.id === c.id}
                  disabled={disabled}
                  onClick={() => pick(c)}
                  className={cn(
                    'flex items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    picked?.id === c.id ? 'border-foreground/30 bg-accent' : 'hover:border-foreground/15',
                    disabled && 'pointer-events-none opacity-50',
                  )}
                >
                  <span className="grid gap-0.5">
                    <span>{cardLabel(c)}</span>
                    {disabled && (
                      <span className="text-xs text-faint-foreground">
                        {c.connected ? 'Already connected' : 'Currency not supported yet'}
                      </span>
                    )}
                  </span>
                  <span className="font-mono whitespace-nowrap tabular-nums">
                    {formatAmount(c.balance)}
                    <span className="ml-1.5 text-xs text-muted-foreground">{c.asset ?? '—'}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {picked && (
            <div className="flex items-center gap-1">
              <Input
                autoComplete="off"
                placeholder="Name"
                aria-label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 flex-1"
              />
              <EmojiPicker onPick={(emoji) => setName((n) => n + emoji)} />
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}

      <SheetFooter>
        <SheetClose render={<Button type="button" variant="secondary" />}>Cancel</SheetClose>
        <Button type="submit" disabled={!valid || busy}>
          {busy && <Loader2 className="animate-spin" />}
          {cards ? 'Connect' : 'Continue'}
        </Button>
      </SheetFooter>
    </form>
  )
}
