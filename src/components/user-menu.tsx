import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { signOut } from '@/lib/auth'
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

/** Header profile button: avatar + email; opens a popover with the account and Log out. */
export function UserMenu({ email }: { email: string }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" className="h-10 gap-2 px-2 text-muted-foreground aria-expanded:text-foreground" />
        }
      >
        <Avatar email={email} />
        <span className="hidden max-w-48 truncate sm:inline">{email}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 gap-4 p-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar email={email} className="size-14 text-xl" />
          <span className="max-w-full truncate text-sm">{email}</span>
        </div>
        <Button variant="outline" onClick={() => signOut()}>
          <LogOut data-icon="inline-start" />
          Log out
        </Button>
      </PopoverContent>
    </Popover>
  )
}
