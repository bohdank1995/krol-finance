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
  const [type, setType] = useState<EntryType>()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger} />
        <DropdownMenuContent align="end" className="w-40">
          {ENTRY_TYPES.map((t) => (
            <DropdownMenuItem key={t.value} disabled={'soon' in t} onClick={() => setType(t.value)}>
              {t.label}
              {'soon' in t && <span className="ml-auto text-faint-foreground">soon</span>}
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

/** Floating Deposit + Withdraw pair: half the screen width each on phones, hugging their labels on desktop. */
export function EntryActions(props: Omit<Props, 'direction' | 'trigger'>) {
  const fab = 'h-12 gap-2 rounded-full px-5 text-base shadow-lg max-sm:flex-1 [&_svg]:size-5'
  return (
    <div className="fixed inset-x-4 bottom-4 z-40 flex gap-3 sm:inset-x-auto sm:right-6 sm:bottom-6">
      <AddEntryMenu
        {...props}
        direction="out"
        trigger={
          <Button variant="secondary" className={`${fab} border-border`}>
            <Minus />
            Withdraw
          </Button>
        }
      />
      <AddEntryMenu
        {...props}
        direction="in"
        trigger={
          <Button className={fab}>
            <Plus />
            Deposit
          </Button>
        }
      />
    </div>
  )
}
