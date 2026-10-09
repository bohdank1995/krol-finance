import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet'
import { addPortfolio, renamePortfolio, type Portfolio } from '@/lib/entries'
import { useT } from '@/lib/i18n'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the drawer only renames this portfolio. */
  portfolio?: Portfolio
  onCreated?: (id: string) => void
}

/** Right-side drawer to create a portfolio (just a name) or rename one. */
export function PortfolioDrawer({ open, onOpenChange, ...rest }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent showCloseButton={false}>
        {/* Remount per open so the form starts empty each time. */}
        {open && <PortfolioForm {...rest} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function PortfolioForm({
  portfolio,
  onCreated,
  onDone,
}: Omit<Props, 'open' | 'onOpenChange'> & { onDone: () => void }) {
  const t = useT()
  const [name, setName] = useState(portfolio?.name ?? '')
  const valid = !!name.trim()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    if (portfolio) renamePortfolio(portfolio.id, name.trim())
    else onCreated?.(addPortfolio(name.trim()))
    onDone()
  }

  return (
    <form onSubmit={submit} className="contents">
      <SheetTitle className="text-sm font-normal text-muted-foreground">
        {portfolio ? t.renamePortfolio : t.newPortfolio}
      </SheetTitle>

      <Input
        autoFocus
        autoComplete="off"
        placeholder={t.name}
        aria-label={t.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-12"
      />

      <SheetFooter>
        <SheetClose render={<Button type="button" variant="secondary" />}>{t.cancel}</SheetClose>
        <Button type="submit" disabled={!valid}>
          {portfolio ? t.save : t.create}
        </Button>
      </SheetFooter>
    </form>
  )
}
