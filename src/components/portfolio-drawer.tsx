import { useState } from 'react'
import { Field } from '@/components/field'
import { GroupIconPicker } from '@/components/group-icon'
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
  /** When set, the drawer edits this group's name and icon, saving them with `onSave`. */
  group?: { name: string; icon?: string; onSave: (name: string, icon: string | undefined) => void }
  onCreated?: (id: string) => void
}

/** Right-side drawer to create a portfolio (just a name), rename one, or edit a group's icon and name. */
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
  const [icon, setIcon] = useState(group?.icon)
  const valid = !!name.trim()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    if (group) group.onSave(name.trim(), icon)
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
        {group ? (
          // The icon sits inline, left of the name.
          <div className="flex items-center gap-2">
            <GroupIconPicker value={icon} onChange={setIcon} className="size-12 rounded-lg border-input" />
            <Input autoFocus autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} className="h-12" />
          </div>
        ) : (
          <Input autoFocus autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} className="h-12" />
        )}
      </Field>

      <SheetFooter>
        <SheetClose render={<Button type="button" variant="secondary" />}>{t.cancel}</SheetClose>
        {action()}
      </SheetFooter>
    </form>
  )
}
