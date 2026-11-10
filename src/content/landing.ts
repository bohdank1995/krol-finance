import type { Language } from '@/lib/language'

/* The home page's texts. The app's own texts are in `src/lib/i18n.ts`; FAQ, Privacy and Terms are English only. */

export const LANDING: Record<
  Language,
  {
    title: string
    headline: string
    subline: string
    google: string
    terms: [string, string, string, string]
    signInFailed: string
    desktopAlt: string
    language: string
    footer: { faq: string; blog: string; privacy: string; terms: string }
  }
> = {
  uk: {
    title: 'Koshel · Облік капіталу та пасивного доходу',
    headline: 'Перетворіть фінансову свободу на реальність',
    subline: 'Фінансовий трекер, який показує ваш пасивний дохід і надихає його збільшувати.',
    google: 'Продовжити з Google',
    terms: ['Продовжуючи, ви погоджуєтеся з ', 'Умовами', ' та ', 'Політикою конфіденційності'],
    signInFailed: 'Не вдалося увійти через Google. Спробуйте ще раз.',
    desktopAlt: 'Дашборд Koshel: ваші джерела, групи Monobank та Interactive Brokers, графік капіталу та активи',
    language: 'Мова',
    footer: { faq: 'Питання', blog: 'Блог', privacy: 'Конфіденційність', terms: 'Умови' },
  },
  en: {
    title: 'Koshel · Track your net worth and passive income',
    headline: 'Make financial freedom real',
    subline: 'A finance tracker designed to show your passive income — and encourage you to grow it.',
    google: 'Continue with Google',
    terms: ['By continuing you agree to the ', 'Terms', ' and ', 'Privacy policy'],
    signInFailed: 'Could not sign in with Google. Try again.',
    desktopAlt: 'The Koshel dashboard: your sources, Monobank and Interactive Brokers groups, a net worth graph and assets',
    language: 'Language',
    footer: { faq: 'FAQ', blog: 'Blog', privacy: 'Privacy', terms: 'Terms' },
  },
}
