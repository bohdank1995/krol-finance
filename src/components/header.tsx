import { CalendarDays, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useT } from '@/lib/i18n'
import { PERIODS, type Period } from '@/lib/period'
import { UserMenu } from './user-menu'

/** Top bar, pinned while scrolling: the left side is kept free (for a logo later), the account sits on the right. */
export function Header({ email, image }: { email: string; image?: string }) {
  return (
    <header className="sticky top-0 z-20 -mx-6 flex items-center justify-end gap-3 bg-background/85 px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md">
      <UserMenu email={email} image={image} />
    </header>
  )
}

/** The tracked period, picked from a dropdown above the cards. */
export function PeriodFilter({ period, onChange }: { period: Period; onChange: (period: Period) => void }) {
  const t = useT()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={t.period}
            className="-ml-1.5 justify-self-start text-muted-foreground aria-expanded:text-foreground"
          />
        }
      >
        <CalendarDays data-icon="inline-start" />
        {t.periods[period]}
        <ChevronDown data-icon="inline-end" className="text-faint-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuRadioGroup value={period} onValueChange={(v) => onChange(v as Period)}>
          {PERIODS.map((p) => (
            <DropdownMenuRadioItem key={p} value={p}>
              {t.periods[p]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
