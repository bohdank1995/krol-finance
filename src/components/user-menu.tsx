import { EyeOff, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { signOut } from '@/lib/auth'
import { setFake, usePreferences } from '@/lib/preferences'
import { cn } from '@/lib/utils'

/** Round avatar: the email's first letter over a blurred brand glow (placed from the email, so it's stable). */
function Avatar({ email, className }: { email: string; className?: string }) {
  const seed = [...email].reduce((n, c) => n + c.charCodeAt(0), 0)
  return (
    <span
      className={cn('relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted', className)}
    >
      <span
        aria-hidden
        className="absolute size-3/5 rounded-full bg-brand/70 blur-md"
        style={{ left: `${(seed % 5) * 10}%`, top: `${((seed >> 3) % 5) * 10}%` }}
      />
      <span className="relative text-[0.9em] font-medium text-foreground uppercase">{email[0]}</span>
    </span>
  )
}

/** Compact header profile button (avatar only); the popover holds the account, Fake numbers and Log out. */
export function UserMenu({ email }: { email: string }) {
  const { fake } = usePreferences()
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" aria-label="Account" className="relative rounded-full" />}
      >
        <Avatar email={email} className="size-7 text-xs" />
        {fake && (
          <span
            title="Fake numbers on"
            className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-background text-muted-foreground"
          >
            <EyeOff className="size-2.5!" />
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-4 p-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar email={email} className="size-14 text-xl" />
          <span className="max-w-full truncate text-sm">{email}</span>
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
          <span className="flex flex-col">
            Fake numbers
            <span className="text-xs text-muted-foreground">Random values, safe to share</span>
          </span>
          <Switch checked={fake} onCheckedChange={setFake} />
        </label>
        <Button variant="outline" onClick={() => signOut()}>
          <LogOut data-icon="inline-start" />
          Log out
        </Button>
      </PopoverContent>
    </Popover>
  )
}
