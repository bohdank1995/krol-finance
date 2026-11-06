import { useState } from 'react'
import { Field } from '@/components/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetBar,
  SheetClose,
  SheetContent,
  SheetFooter,
} from '@/components/ui/sheet'
import { addPortfolio, renamePortfolio, type Portfolio } from '@/lib/entries'
import { useT } from '@/lib/i18n'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the drawer only renames this portfolio. */
  portfolio?: Portfolio
  /** When set, the drawer only renames this group, saving the name with `onRename`. */
  group?: { name: string; onRename: (name: string) => void }
  onCreated?: (id: string) => void
}

/** Right-side drawer to create a portfolio (just a name), or rename one or a group. */
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
  group,
  onCreated,
  onDone,
}: Omit<Props, 'open' | 'onOpenChange'> & { onDone: () => void }) {
  const t = useT()
  const [name, setName] = useState(group?.name ?? portfolio?.name ?? '')
  const valid = !!name.trim()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    if (group) group.onRename(name.trim())
    else if (portfolio) renamePortfolio(portfolio.id, name.trim())
    else onCreated?.(addPortfolio(name.trim()))
    onDone()
  }

  const action = (size?: 'sm') => (
    <Button type="submit" size={size} disabled={!valid}>
      {portfolio || group ? t.save : t.create}
    </Button>
  )

  return (
    <form onSubmit={submit} className="contents">
      <SheetBar title={group ? t.renameGroup : portfolio ? t.renamePortfolio : t.newPortfolio} action={action('sm')} cancel={t.cancel} />

      <Field label={group ? t.groupName : t.name}>
        <Input
          autoFocus
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12"
        />
      </Field>

      <SheetFooter>
        <SheetClose render={<Button type="button" variant="secondary" />}>{t.cancel}</SheetClose>
        {action()}
      </SheetFooter>
    </form>
  )
}
