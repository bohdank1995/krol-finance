import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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

/** The tracked period, picked from a segmented control above the cards (scrolls sideways on narrow screens). */
export function PeriodFilter({ period, onChange }: { period: Period; onChange: (period: Period) => void }) {
  const t = useT()
  return (
    <div className="-mx-6 overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ToggleGroup
        size="sm"
        variant="outline"
        spacing={0}
        aria-label={t.period}
        value={[period]}
        // Clicking the already-chosen one would empty the group: keep it.
        onValueChange={(v: string[]) => v[0] && onChange(v[0] as Period)}
      >
        {PERIODS.map((p, i) => (
          <ToggleGroupItem
            key={p}
            value={p}
            style={{ animationDelay: `${i * 40}ms` }}
            className="animate-enter px-3 text-xs text-muted-foreground aria-pressed:text-foreground"
          >
            {t.periods[p]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
