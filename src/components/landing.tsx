import desktopEn768 from '@/assets/landing-desktop-en-768.webp'
import desktopEn1440 from '@/assets/landing-desktop-en-1440.webp'
import desktopEn2880 from '@/assets/landing-desktop-en-2880.webp'
import desktopUk768 from '@/assets/landing-desktop-uk-768.webp'
import desktopUk1440 from '@/assets/landing-desktop-uk-1440.webp'
import desktopUk2880 from '@/assets/landing-desktop-uk-2880.webp'
import phoneEn from '@/assets/landing-phone-en.webp'
import phoneUk from '@/assets/landing-phone-uk.webp'
import { useEffect } from 'react'
import { Bar } from '@/components/app-shell'
import { SiteFooter } from '@/components/site'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { LANDING } from '@/content/landing'
import { applyLanguage, currentLanguage, LANGUAGES, useLanguage, type Language } from '@/lib/language'

/** The app in each language (fake numbers, neutral names): a 1440×900 desktop at three widths, and an iPhone at 3×. */
const PREVIEW: Record<Language, { desktop: [string, string, string]; phone: string }> = {
  uk: { desktop: [desktopUk768, desktopUk1440, desktopUk2880], phone: phoneUk },
  en: { desktop: [desktopEn768, desktopEn1440, desktopEn2880], phone: phoneEn },
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.63 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.7 14.54 2.75 12 2.75 6.89 2.75 2.75 6.89 2.75 12S6.89 21.25 12 21.25c5.34 0 8.88-3.75 8.88-9.04 0-.61-.07-1.07-.15-1.53z" />
    </svg>
  )
}

/** The home page itself, without sign-in logic: it's also rendered ahead of time for search engines. */
export function Landing({ onGoogle, busy, error }: { onGoogle?: () => void; busy?: boolean; error?: string }) {
  const language = useLanguage()
  const t = LANDING[language]
  const preview = PREVIEW[language]
  useEffect(() => {
    // Hydrated in Ukrainian first; once the visitor's language is on screen, show the page (index.html hid it).
    if (language !== currentLanguage()) return
    document.title = t.title
    delete document.documentElement.dataset.relang
  }, [language, t.title])

  return (
    <main className="flex min-h-svh flex-col items-center gap-14 overflow-x-clip px-4 pb-10">
      {/* The same top bar as the app: the logo on the left, the language on the right. */}
      <div className="w-full px-2">
        <Bar
          account={
            <ToggleGroup
              size="sm"
              spacing={0}
              aria-label={t.language}
              value={[language]}
              // Clicking the already-chosen one would empty the group: keep it.
              onValueChange={(v: string[]) => v[0] && applyLanguage(v[0] as Language, { remember: true })}
              className="font-mono"
            >
              {LANGUAGES.map((l) => (
                <ToggleGroupItem key={l.value} value={l.value} lang={l.value} className="px-2 text-xs text-muted-foreground aria-pressed:text-foreground">
                  {l.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          }
        />
      </div>
      {/* The home page for visitors (and Google's app review): what Koshel is for, sign-in, a look at the app. */}
      <div className="flex max-w-xl flex-col items-center gap-6 pt-4 text-center sm:pt-12">
        <h1 className="text-3xl font-medium text-balance text-foreground sm:text-5xl">{t.headline}</h1>
        <p className="max-w-md text-base text-balance text-muted-foreground">
          {t.subline}
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Button onClick={onGoogle} disabled={busy} className="h-12 gap-2">
            <GoogleIcon />
            {t.google}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            {t.terms[0]}
            <a href="/terms" className="underline underline-offset-4 hover:text-foreground">
              {t.terms[1]}
            </a>
            {t.terms[2]}
            <a href="/privacy" className="underline underline-offset-4 hover:text-foreground">
              {t.terms[3]}
            </a>
            .
          </p>
        </div>
      </div>

      {/* The app, cut off above (its own logo and avatar bar would repeat ours) and below the graph, fading into the page:
          the desktop on wider screens, a phone on phones. The image is pulled up by the bar's height (72 of 393 points on
          the phone, 80 of 1440 on desktop; margins in % follow the width). */}
      <div className="relative w-full max-w-[300px] sm:max-w-7xl">
        <div className="aspect-[393/628] overflow-hidden rounded-t-[2.5rem] border border-b-0 border-border shadow-[0_24px_80px_-12px_rgb(0_0_0/0.7)] sm:aspect-[1440/580] sm:rounded-t-xl">
          <picture>
            <source media="(max-width: 639px)" srcSet={preview.phone} width={1179} height={2556} />
            <img
              src={preview.desktop[2]}
              srcSet={`${preview.desktop[0]} 768w, ${preview.desktop[1]} 1440w, ${preview.desktop[2]} 2880w`}
              sizes="(min-width: 1312px) 1280px, calc(100vw - 2rem)"
              width={2880}
              height={1800}
              fetchPriority="high"
              alt={t.desktopAlt}
              className="-mt-[18.32%] h-auto w-full sm:-mt-[5.556%]"
            />
          </picture>
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-b from-transparent to-background" />
      </div>

      <SiteFooter language={language} />
    </main>
  )
}
