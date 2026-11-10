import { Check } from 'lucide-react'
import ibkrMark from '@/assets/ibkr.svg'
import monobankMark from '@/assets/monobank-mark.svg'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/* A group's icon: a small rounded tile in a picked colour with a white Monobank or Interactive Brokers logo,
   shown left of the group's name. Stored on the group as `<logo>:<colour>` (`groups.icon`, checked in
   convex/data.ts); no icon when unset. */

const LOGOS = [
  { value: 'monobank', label: 'Monobank', src: monobankMark, inset: '0%' },
  { value: 'ibkr', label: 'Interactive Brokers', src: ibkrMark, inset: '12%' },
] as const
export type Logo = (typeof LOGOS)[number]['value']

/** "brand" is the logo's own colour; the rest are shared. Colours are theme tokens (`--tile-*` in index.css). */
const COLOURS = ['brand', 'pink', 'orange', 'yellow', 'green', 'blue', 'violet'] as const
export type Colour = (typeof COLOURS)[number]

function parse(icon: string | undefined) {
  const [logo, colour] = icon?.split(':') ?? []
  const found = LOGOS.find((l) => l.value === logo)
  if (!found || !COLOURS.includes(colour as Colour)) return undefined
  return { logo: found, colour: colour as Colour }
}

const fill = (logo: Logo, colour: Colour) => `var(--tile-${colour === 'brand' ? logo : colour})`

/** The tile itself; nothing when the group has no icon. */
export function GroupIcon({ icon, className }: { icon?: string; className?: string }) {
  const parsed = parse(icon)
  if (!parsed) return null
  const { logo, colour } = parsed
  return (
    <span
      aria-hidden
      style={{ background: fill(logo.value, colour) }}
      className={cn('relative inline-block size-5 shrink-0 rounded-[28%] ring-1 ring-foreground/10 ring-inset', className)}
    >
      <span
        style={{ inset: logo.inset, maskImage: `url("${logo.src}")`, WebkitMaskImage: `url("${logo.src}")` }}
        className="absolute bg-tile-foreground mask-contain mask-center mask-no-repeat"
      />
    </span>
  )
}

/** A button showing the group's tile (a dashed square when it has none) that opens the choice of icons. */
export function GroupIconPicker({
  value,
  onChange,
  className,
}: {
  value?: string
  onChange: (icon: string | undefined) => void
  className?: string
}) {
  const t = useT()
  const current = parse(value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t.groupIcon}
        className={cn(
          'flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent outline-none hover:border-input focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:border-input',
          className,
        )}
      >
        {current ? (
          <GroupIcon icon={value} className="size-6" />
        ) : (
          <span aria-hidden className="size-6 rounded-[28%] border border-dashed border-faint-foreground" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto">
        <DropdownMenuItem onClick={() => onChange(undefined)}>
          <span aria-hidden className="size-5 rounded-[28%] border border-dashed border-faint-foreground" />
          {t.noIcon}
          {!current && <Check className="ml-auto text-muted-foreground" />}
        </DropdownMenuItem>
        {LOGOS.map((logo) => (
          <DropdownMenuGroup key={logo.value}>
            <DropdownMenuLabel>{logo.label}</DropdownMenuLabel>
            <div className="flex gap-1 px-1.5 pb-1">
              {COLOURS.map((colour) => {
                const icon = `${logo.value}:${colour}`
                return (
                  <DropdownMenuItem
                    key={colour}
                    aria-label={`${logo.label}, ${t.colours[colour]}`}
                    onClick={() => onChange(icon)}
                    className={cn('p-1.5', value === icon && 'bg-accent ring-1 ring-foreground/30')}
                  >
                    <GroupIcon icon={icon} className="size-7" />
                  </DropdownMenuItem>
                )
              })}
            </div>
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
