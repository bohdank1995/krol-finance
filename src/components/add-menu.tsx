import { useState } from 'react'
import { Bitcoin, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CryptoDialog } from './crypto-dialog'

export function AddMenu() {
  const [cryptoOpen, setCryptoOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button className="px-3" />}>
          <Plus data-icon="inline-start" />
          Add
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-40">
          <DropdownMenuItem onClick={() => setCryptoOpen(true)}>
            <Bitcoin className="text-muted-foreground" />
            Crypto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CryptoDialog open={cryptoOpen} onOpenChange={setCryptoOpen} />
    </>
  )
}
