import logo from '@/assets/koshel-logo.svg'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useT } from '@/lib/i18n'
import { PERIODS, type Period } from '@/lib/period'
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

/** The tracked period, picked from a dropdown above the cards. */
export function PeriodFilter({ period, onChange }: { period: Period; onChange: (period: Period) => void }) {
  const t = useT()
  return (
    <Select
      value={period}
      onValueChange={(v) => v && onChange(v as Period)}
      items={PERIODS.map((p) => ({ value: p, label: t.periods[p] }))}
    >
      <SelectTrigger aria-label={t.period} className="animate-enter min-w-40 rounded-full text-muted-foreground hover:text-foreground">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start">
        {PERIODS.map((p) => (
          <SelectItem key={p} value={p}>
            {t.periods[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
