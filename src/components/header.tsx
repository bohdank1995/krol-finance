import { CalendarDays, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PERIODS, type Period } from '@/lib/period'
import { CURRENCIES, setCurrency, usePreferences, type Currency } from '@/lib/preferences'
import { UserMenu } from './user-menu'

type Props = {
  email: string
  period: Period
  onPeriodChange: (period: Period) => void
}

/** Top bar, pinned while scrolling: account on the left (a logo goes next to it later), period and currency on the right. */
export function Header({ email, period, onPeriodChange }: Props) {
  const { currency } = usePreferences()
  return (
    <header className="sticky top-0 z-20 -mx-6 flex items-center justify-between gap-3 bg-background/85 px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md">
      <UserMenu email={email} />
      <div className="flex items-center gap-1 sm:gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm" className="text-muted-foreground aria-expanded:text-foreground" />
            }
          >
            <CalendarDays data-icon="inline-start" />
            {PERIODS.find((p) => p.value === period)?.label}
            <ChevronDown data-icon="inline-end" className="text-faint-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuRadioGroup value={period} onValueChange={(v) => onPeriodChange(v as Period)}>
              {PERIODS.map((p) => (
                <DropdownMenuRadioItem key={p.value} value={p.value}>
                  {p.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <ToggleGroup
          size="sm"
          spacing={0}
          aria-label="Currency"
          value={[currency]}
          // Clicking the already-chosen one would empty the group: keep it.
          onValueChange={(v: string[]) => v[0] && setCurrency(v[0] as Currency)}
          className="font-mono"
        >
          {CURRENCIES.map((c) => (
            <ToggleGroupItem key={c} value={c} className="px-2 text-xs text-muted-foreground aria-pressed:text-foreground">
              {c}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </header>
  )
}
