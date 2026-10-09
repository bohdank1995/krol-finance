import { useState } from 'react'
import { EyeOff, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { currencySign } from '@/lib/assets'
import { useSignOut } from '@/lib/auth'
import { LANGUAGES, setLanguage, useLanguage, useT, type Language } from '@/lib/i18n'
import { CURRENCIES, setCurrency, setFake, usePreferences, type Currency } from '@/lib/preferences'
import { cn } from '@/lib/utils'

/** Round avatar: the email's first letter over a blurred brand glow (placed from the email, so it's stable). */
function Avatar({ email, image, className }: { email: string; image?: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const seed = [...email].reduce((n, c) => n + c.charCodeAt(0), 0)
  if (image && !failed)
    return (
      <img
        src={image}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn('size-8 shrink-0 rounded-full object-cover', className)}
      />
    )
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

/** A labelled row with a compact one-of-a-few switch (currency, language). */
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      {label}
      <ToggleGroup
        size="sm"
        spacing={0}
        aria-label={label}
        value={[value]}
        // Clicking the already-chosen one would empty the group: keep it.
        onValueChange={(v: string[]) => v[0] && onChange(v[0] as T)}
        className="font-mono"
      >
        {options.map((o) => (
          <ToggleGroupItem key={o.value} value={o.value} className="px-2 text-xs text-muted-foreground aria-pressed:text-foreground">
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

/** Compact header profile button (avatar only); the popover holds the account, currency, language, Fake numbers and Log out. */
export function UserMenu({ email, image }: { email: string; image?: string }) {
  const t = useT()
  const language = useLanguage()
  const signOut = useSignOut()
  const { currency, fake } = usePreferences()
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="icon-lg" aria-label={t.account} className="relative" />}
      >
        {/* Fills the button inside its border, which matches the "+" button. */}
        <Avatar email={email} image={image} className="size-full text-base" />
        {fake && (
          <span
            title={t.fakeNumbersOn}
            className="absolute right-0 bottom-0 flex size-4 items-center justify-center rounded-full bg-background text-muted-foreground"
          >
            <EyeOff className="size-2.5!" />
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-4 p-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar email={email} image={image} className="size-14 text-xl" />
          <span className="max-w-full truncate text-sm">{email}</span>
        </div>
        <Choice<Currency>
          label={t.currency}
          value={currency}
          options={CURRENCIES.map((c) => ({ value: c, label: currencySign(c) }))}
          onChange={setCurrency}
        />
        <Choice<Language> label={t.language} value={language} options={LANGUAGES} onChange={setLanguage} />
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
          <span className="flex flex-col">
            {t.fakeNumbers}
            <span className="text-xs text-muted-foreground">{t.fakeNumbersHint}</span>
          </span>
          <Switch checked={fake} onCheckedChange={setFake} />
        </label>
        <Button variant="secondary" onClick={() => signOut()}>
          <LogOut data-icon="inline-start" />
          {t.logOut}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
