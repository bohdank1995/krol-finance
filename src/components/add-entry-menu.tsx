import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ENTRY_TYPES, type EntryType } from '@/lib/assets'
import type { Portfolio } from '@/lib/entries'
import { useT } from '@/lib/i18n'
import { EntryDrawer, type Direction } from './entry-drawer'

type Props = {
  portfolios: Portfolio[]
  /** Set when a single portfolio is selected; unset on Net worth (the drawer then asks which). */
  portfolioId?: string
  /** Deposit adds, withdraw subtracts — the drawer no longer asks. */
  direction: Direction
  /** The button that opens the type dropdown. */
  trigger: React.ReactElement
}

/** Deposit / Withdraw: first pick the entry type in a dropdown, then the drawer opens. */
export function AddEntryMenu({ portfolios, portfolioId, direction, trigger }: Props) {
  const t = useT()
  const [type, setType] = useState<EntryType>()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger} />
        <DropdownMenuContent align="end" className="w-56">
          {ENTRY_TYPES.map((e) => (
            <DropdownMenuItem key={e.value} disabled={'soon' in e} onClick={() => setType(e.value)}>
              {t.entryTypes[e.value]}
              {'soon' in e && <span className="ml-auto text-faint-foreground">{t.soon}</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <EntryDrawer
        open={!!type}
        onOpenChange={(open) => !open && setType(undefined)}
        portfolios={portfolios}
        portfolioId={portfolioId}
        type={type}
        direction={direction}
      />
    </>
  )
}

/** Where the floating buttons sit: full width on phones (4 from the edges), bottom-right on desktop. */
export const FAB_BAR = 'fixed inset-x-4 bottom-4 z-40 flex gap-3 sm:inset-x-auto sm:right-6 sm:bottom-6'
/** A floating button: half the screen each when paired (full width alone) on phones. */
export const FAB = 'shadow-lg max-sm:flex-1'

/** Floating Deposit + Withdraw pair: half the screen width each on phones, hugging their labels on desktop. */
export function EntryActions(props: Omit<Props, 'direction' | 'trigger'>) {
  const t = useT()
  return (
    <div className={FAB_BAR}>
      <AddEntryMenu
        {...props}
        direction="out"
        trigger={
          <Button variant="secondary" className={FAB}>
            <Minus />
            {t.withdraw}
          </Button>
        }
      />
      <AddEntryMenu
        {...props}
        direction="in"
        trigger={
          <Button className={FAB}>
            <Plus />
            {t.deposit}
          </Button>
        }
      />
    </div>
  )
}
