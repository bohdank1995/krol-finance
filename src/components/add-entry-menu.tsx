import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ENTRY_TYPES, type EntryType } from '@/lib/assets'
import type { Portfolio } from '@/lib/entries'
import { EntryDrawer } from './entry-drawer'

type Props = {
  portfolios: Portfolio[]
  /** Set when a single portfolio is selected; unset on Net worth (the drawer then asks which). */
  portfolioId?: string
  /** The button that opens the type dropdown. */
  trigger: React.ReactElement
}

/** "Add entry": first pick the entry type in a dropdown, then the drawer opens. */
export function AddEntryMenu({ portfolios, portfolioId, trigger }: Props) {
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
      />
    </>
  )
}

export function AddEntryButton(props: Omit<Props, 'trigger'>) {
  return (
    <AddEntryMenu
      {...props}
      trigger={
        <Button variant="outline">
          <Plus data-icon="inline-start" />
          Add entry
        </Button>
      }
    />
  )
}
