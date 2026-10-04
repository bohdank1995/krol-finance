import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet'
import { connectIbkr, listIbkrPositions, type IbkrPosition } from '@/lib/entries'
import { formatAmount, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EmojiPicker } from './emoji-picker'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (id: string) => void
}

/** Right-side drawer to connect Interactive Brokers: follow the guide, paste token + Query ID, pick stocks. */
export function IbkrDrawer({ open, onOpenChange, onCreated }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent showCloseButton={false}>
        {/* Remount per open so the flow starts from the guide each time. */}
        {open && <IbkrFlow onCreated={onCreated} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

const link = 'text-foreground underline underline-offset-4'
const strong = 'text-foreground'

const STEPS = [
  <>
    In the{' '}
    <a href="https://www.interactivebrokers.com/portal" target="_blank" rel="noreferrer" className={link}>
      IBKR portal
    </a>
    , open <span className={strong}>Performance & Reports → Flex Queries</span> and create an{' '}
    <span className={strong}>Activity Flex Query</span>.
  </>,
  <>
    Add the <span className={strong}>Open Positions</span> section, tick <span className={strong}>Select all</span>{' '}
    fields, and choose <span className={strong}>Summary</span> in its options.
  </>,
  <>
    Set the format to <span className={strong}>XML</span> and the period to{' '}
    <span className={strong}>Last Business Day</span>. Save, then copy the <span className={strong}>Query ID</span>{' '}
    shown next to the query.
  </>,
  <>
    On the same page, open <span className={strong}>Flex Web Service Configuration</span>, turn it on and generate a{' '}
    <span className={strong}>token</span>.
  </>,
]

function IbkrFlow({ onCreated, onDone }: { onCreated?: (id: string) => void; onDone: () => void }) {
  const [token, setToken] = useState('')
  const [queryId, setQueryId] = useState('')
  const [positions, setPositions] = useState<IbkrPosition[]>()
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [name, setName] = useState('Interactive Brokers')
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

  const available = (positions ?? []).filter((p) => !p.connected && p.value !== null)
  const allPicked = available.length > 0 && available.every((p) => picked.has(p.asset))
  // Only a card holding every stock can also follow ones bought later.
  const followsNew = allPicked && !positions?.some((p) => p.connected)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!positions) {
      if (token.trim() && queryId.trim())
        run(async () => {
          const list = await listIbkrPositions(token.trim(), queryId.trim())
          setPositions(list)
          // Everything that can be connected starts selected; untick what to leave out.
          setPicked(new Set(list.filter((p) => !p.connected && p.value !== null).map((p) => p.asset)))
        })
    } else if (picked.size && name.trim()) {
      run(async () => {
        const assets = available.filter((p) => picked.has(p.asset)).map((p) => p.asset)
        const id = await connectIbkr(name.trim(), assets, allPicked)
        onCreated?.(id)
        onDone()
      })
    }
  }

  const toggle = (asset: string, on: boolean) =>
    setPicked((s) => {
      const next = new Set(s)
      if (on) next.add(asset)
      else next.delete(asset)
      return next
    })

  const valid = positions ? picked.size > 0 && !!name.trim() : !!token.trim() && !!queryId.trim()

  return (
    <form onSubmit={submit} className="contents">
      <SheetTitle className="text-sm font-normal text-muted-foreground">
        {positions ? 'Pick stocks' : 'Connect Interactive Brokers'}
      </SheetTitle>

      {!positions ? (
        <div className="grid gap-5">
          <p className="text-muted-foreground">
            IBKR shares your stocks through a read-only report: it can’t trade or move money. Set it up once:
          </p>
          <ol className="grid gap-3">
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-3 text-muted-foreground">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-xs text-foreground tabular-nums">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="grid gap-2">
            <Input
              autoFocus
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="Token"
              aria-label="IBKR Flex token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="h-12 font-mono"
            />
            <Input
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              placeholder="Query ID"
              aria-label="Flex Query ID"
              value={queryId}
              onChange={(e) => setQueryId(e.target.value)}
              className="h-12 font-mono"
            />
          </div>
          <p className="text-xs text-faint-foreground">
            {busy
              ? 'IBKR is preparing the report. This can take up to half a minute…'
              : 'Holdings update once a day; prices update every 30 seconds.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {positions.length === 0 ? (
            <p className="text-muted-foreground">No stocks found in this account.</p>
          ) : (
            <>
              <label
                className={cn(
                  'flex items-center gap-3 px-4',
                  available.length === 0 && 'pointer-events-none opacity-50',
                )}
              >
                <Checkbox
                  checked={allPicked}
                  indeterminate={picked.size > 0 && !allPicked}
                  disabled={available.length === 0}
                  onCheckedChange={(on) => setPicked(new Set(on ? available.map((p) => p.asset) : []))}
                />
                <span>Select all</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
                  {picked.size} of {available.length}
                </span>
              </label>

              <div role="group" aria-label="Stocks" className="grid gap-2">
                {positions.map((p) => {
                  const disabled = p.connected || p.value === null
                  const on = picked.has(p.asset)
                  return (
                    <label
                      key={p.asset}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                        on ? 'border-foreground/30 bg-accent' : 'hover:border-foreground/15',
                        disabled && 'pointer-events-none opacity-50',
                      )}
                    >
                      <Checkbox checked={on} disabled={disabled} onCheckedChange={(v) => toggle(p.asset, v)} />
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="font-mono">{p.symbol}</span>
                        <span className="truncate text-xs text-faint-foreground">
                          {p.connected ? 'Already connected' : p.value === null ? 'Price not available' : p.name}
                        </span>
                      </span>
                      <span className="grid gap-0.5 text-right font-mono whitespace-nowrap tabular-nums">
                        <span>
                          {p.value === null ? '—' : formatMoney(p.value)}
                          <span className="ml-1.5 text-xs text-muted-foreground">USD</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{formatAmount(p.quantity)} sh</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </>
          )}

          {picked.size > 0 && (
            <div className="grid gap-2">
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
              {followsNew && (
                <p className="text-xs text-faint-foreground">New stocks you buy will be added automatically.</p>
              )}
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
          {positions ? 'Connect' : 'Continue'}
        </Button>
      </SheetFooter>
    </form>
  )
}
