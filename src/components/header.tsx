import logo from '@/assets/koshel-logo.svg'
import { Check, ChevronDown, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useT } from '@/lib/i18n'
import { PRESETS, UNITS, type Period, type Unit } from '@/lib/period'
import { cn } from '@/lib/utils'
import { UserMenu } from './user-menu'

/** Top bar, pinned while scrolling: the Koshel logo on the left, the account on the right. */
export function Header({ email, image }: { email: string; image?: string }) {
  return (
    <header className="sticky top-0 z-20 -mx-6 flex items-center justify-between gap-3 bg-background/85 px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md">
      {/* The logo file is used as a mask so it takes the theme's text color. */}
      <span
        role="img"
        aria-label="Koshel"
        style={{ maskImage: `url(${logo})`, WebkitMaskImage: `url(${logo})` }}
        className="aspect-958/370 h-10 bg-foreground mask-contain mask-no-repeat"
      />
      <UserMenu email={email} image={image} />
    </header>
  )
}

/** The tracked period: a list of presets above the cards, plus "In the last N days / weeks / months / years". */
export function PeriodFilter({ period, onChange }: { period: Period; onChange: (period: Period) => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const custom = typeof period === 'object'
  // The "In the last" row keeps its numbers while a preset is picked, so switching back is one click.
  const [draft, setDraft] = useState(custom ? period : { last: 7, unit: 'days' as Unit })
  const apply = (next: { last: number; unit: Unit }) => {
    setDraft(next)
    onChange(next)
  }
  const label = custom ? t.lastN(period.last, t.units(period.unit, period.last)) : t.periods[period]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={t.period}
        className="animate-enter flex h-12 w-fit min-w-40 items-center justify-between gap-1.5 rounded-full border border-input py-2 pr-3 pl-4 text-base whitespace-nowrap text-muted-foreground transition-colors outline-none select-none hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
      >
        {label}
        <ChevronDown className="size-5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-(--available-height) w-auto min-w-64 gap-0 overflow-y-auto rounded-xl p-1.5"
      >
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              onChange(p)
              setOpen(false)
            }}
            className={cn(
              'flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-base outline-none hover:bg-accent focus-visible:bg-accent',
              p === period && 'bg-accent',
            )}
          >
            {t.periods[p]}
            {p === period && <Check className="size-4" />}
          </button>
        ))}
        <div className={cn('mt-1 flex items-center gap-2 rounded-lg py-1.5 pr-1.5 pl-3', custom && 'bg-accent')}>
          <button type="button" onClick={() => apply(draft)} className="mr-auto text-base whitespace-nowrap outline-none">
            {t.inTheLast}
          </button>
          <div className="flex h-9 items-center rounded-lg border border-input dark:bg-input/30">
            <button
              type="button"
              aria-label={t.fewer}
              disabled={draft.last <= 1}
              onClick={() => apply({ ...draft, last: draft.last - 1 })}
              className="flex h-full w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <Minus className="size-3.5" />
            </button>
            <input
              inputMode="numeric"
              aria-label={t.inTheLast}
              value={draft.last}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const n = Math.min(MAX, Number(e.target.value.replace(/\D/g, '')))
                if (n >= 1) apply({ ...draft, last: n })
              }}
              className="w-10 bg-transparent text-center font-mono text-sm tabular-nums outline-none"
            />
            <button
              type="button"
              aria-label={t.more}
              disabled={draft.last >= MAX}
              onClick={() => apply({ ...draft, last: draft.last + 1 })}
              className="flex h-full w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <Select
            value={draft.unit}
            onValueChange={(v) => v && apply({ ...draft, unit: v as Unit })}
            items={UNITS.map((u) => ({ value: u, label: t.units(u, draft.last) }))}
          >
            <SelectTrigger size="sm" aria-label={t.inTheLast} className="min-w-28 pl-3 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} align="end">
              {UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {t.units(u, draft.last)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** The largest N in "In the last N …". */
const MAX = 999
