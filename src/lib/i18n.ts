import { useSyncExternalStore } from 'react'
import type { EntryType } from './assets'
import type { Period } from './period'
import { api } from '../../convex/_generated/api'
import { convex } from './convex'

/* App language. Ukrainian by default; the user's pick is saved on their account
   (the `language` field of their Convex user), so it follows them to every device. The sign-in page
   stays in English and doesn't use this. */

export const LANGUAGES = [
  { value: 'uk', label: 'UA' },
  { value: 'en', label: 'EN' },
] as const
export type Language = (typeof LANGUAGES)[number]['value']

const DEFAULT: Language = 'uk'
const isLanguage = (v: unknown): v is Language => LANGUAGES.some((l) => l.value === v)

const en = {
  cancel: 'Cancel',
  save: 'Save',
  delete: 'Delete',
  create: 'Create',
  connect: 'Connect',
  continue: 'Continue',
  name: 'Name',
  note: 'Note',
  date: 'Date',
  amount: 'Amount',
  asset: 'Asset',
  portfolio: 'Portfolio',
  token: 'Token',
  addEmoji: 'Add emoji',
  somethingWrong: 'Something went wrong. Try again.',
  alreadyConnected: 'Already connected',

  account: 'Account',
  currency: 'Currency',
  language: 'Language',
  fakeNumbers: 'Fake numbers',
  fakeNumbersHint: 'Random values, safe to share',
  fakeNumbersOn: 'Fake numbers on',
  logOut: 'Log out',

  period: 'Period',
  periods: {
    all: 'All time',
    'last-month': 'Last month',
    'prev-month': 'Previous month',
    'last-quarter': 'Last quarter',
    'last-year': 'Last year',
  } satisfies Record<Period, string>,

  entryTypes: { money: 'Money', crypto: 'Crypto', stocks: 'Stocks' } satisfies Record<EntryType, string>,
  soon: 'soon',
  /** Overrides for asset names in the asset picker. */
  assetNames: {} as Record<string, string>,

  netWorth: 'Net worth',
  portfolios: 'Portfolios',
  loadingPortfolios: 'Loading portfolios',
  portfolioActions: (name: string) => `${name} actions`,
  rename: 'Rename',
  setPercentages: 'Set percentages',
  hideFromNetWorth: 'Hide from net worth',
  showInNetWorth: 'Show in net worth',
  hiddenFromNetWorth: 'Hidden from net worth',
  countsInNetWorth: (percent: number) => `${percent}% counts in net worth`,
  disconnect: 'Disconnect',
  addPortfolio: 'Add portfolio',
  custom: 'Custom',
  showCard: (name: string) => `Show ${name}`,
  synced: (ago: string) => `Synced ${ago}`,
  shareOf: (percent: number, total: string) => `${percent}% of ${total}`,
  live: 'Live',
  reconnecting: 'Reconnecting',
  /** Text before and after the portfolio's name in the delete confirmation. */
  confirmDeletePortfolio: (synced: boolean) =>
    synced ? ['Disconnect', 'and remove its synced entries?'] : ['Delete', 'and all its entries?'],
  confirmDeleteEntry: ['Delete', '?'],

  ago: {
    now: 'just now',
    minutes: (n: number) => `${n}m ago`,
    hours: (n: number) => `${n}h ago`,
    days: (n: number) => `${n}d ago`,
  },
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

  rowActions: 'Row actions',
  edit: 'Edit',
  loadingEntries: 'Loading entries',
  empty: {
    noPortfolios: 'Create your first portfolio with the + card above.',
    period: 'Nothing in this period.',
    noStocks: 'No stocks in this portfolio.',
    noTransactions: 'No transactions in the last 31 days.',
    noEntries: 'No entries yet. Make a deposit to see a balance.',
  },

  value: 'Value',
  loadingGraph: 'Loading graph',

  deposit: 'Deposit',
  withdraw: 'Withdraw',
  entryTitle: (direction: 'in' | 'out', type: EntryType, editing: boolean) => {
    const label = en.entryTypes[type].toLowerCase()
    if (editing) return `Edit ${label} ${direction === 'out' ? 'withdrawal' : 'deposit'}`
    return `${direction === 'out' ? 'Withdraw' : 'Deposit'} ${label}`
  },

  renamePortfolio: 'Rename portfolio',
  newPortfolio: 'New portfolio',

  percentages: 'Percentages',
  cardShows: 'Card shows',
  countsInNetWorthLabel: 'Counts in net worth',
  cardPercentError: 'Above 0, up to 100',
  netWorthPercentError: 'Between 0 and 100',
  partOf: (part: string, total: string) => `${part} of ${total}`,
  hiddenNote: 'Hidden from net worth for now — show it again from the card menu.',

  monobank: {
    pickCard: 'Pick a card',
    connect: 'Connect Monobank',
    /** Text before and after the api.monobank.ua link. */
    intro: [
      'Open',
      ', scan the QR code with the Monobank app, then paste the token here. It can only read balances and transactions.',
    ],
    tokenLabel: 'Monobank token',
    noCards: 'No cards found on this account.',
    cards: 'Cards',
    currencyNotSupported: 'Currency not supported yet',
    unreachable: 'Could not reach Monobank. Try again.',
  },

  ibkr: {
    pickStocks: 'Pick stocks',
    connect: 'Connect Interactive Brokers',
    intro: 'IBKR shares your stocks through a read-only report: it can’t trade or move money. Set it up once:',
    tokenLabel: 'IBKR Flex token',
    queryId: 'Query ID',
    queryIdLabel: 'Flex Query ID',
    preparing: 'IBKR is preparing the report. This can take up to half a minute…',
    updates: 'Holdings update once a day; prices update every 30 seconds.',
    noStocks: 'No stocks found in this account.',
    selectAll: 'Select all',
    picked: (n: number, of: number) => `${n} of ${of}`,
    stocks: 'Stocks',
    priceUnavailable: 'Price not available',
    shares: 'sh',
    followsNew: 'New stocks you buy will be added automatically.',
    unreachable: 'Could not reach Interactive Brokers. Try again.',
  },
}

export type Dictionary = typeof en

const uk: Dictionary = {
  cancel: 'Скасувати',
  save: 'Зберегти',
  delete: 'Видалити',
  create: 'Створити',
  connect: 'Підключити',
  continue: 'Продовжити',
  name: 'Назва',
  note: 'Нотатка',
  date: 'Дата',
  amount: 'Сума',
  asset: 'Актив',
  portfolio: 'Портфель',
  token: 'Токен',
  addEmoji: 'Додати емодзі',
  somethingWrong: 'Щось пішло не так. Спробуйте ще раз.',
  alreadyConnected: 'Уже підключено',

  account: 'Акаунт',
  currency: 'Валюта',
  language: 'Мова',
  fakeNumbers: 'Вигадані числа',
  fakeNumbersHint: 'Безпечно для скриншотів',
  fakeNumbersOn: 'Вигадані числа увімкнено',
  logOut: 'Вийти',

  period: 'Період',
  periods: {
    all: 'Весь час',
    'last-month': 'Останній місяць',
    'prev-month': 'Попередній місяць',
    'last-quarter': 'Останній квартал',
    'last-year': 'Останній рік',
  },

  entryTypes: { money: 'Гроші', crypto: 'Крипта', stocks: 'Акції' },
  soon: 'скоро',
  assetNames: {
    USD: 'Долар США',
    EUR: 'Євро',
    UAH: 'Українська гривня',
    PLN: 'Польський злотий',
  },

  netWorth: 'Капітал',
  portfolios: 'Портфелі',
  loadingPortfolios: 'Завантаження портфелів',
  portfolioActions: (name) => `Дії: ${name}`,
  rename: 'Перейменувати',
  setPercentages: 'Налаштувати відсотки',
  hideFromNetWorth: 'Не враховувати в капіталі',
  showInNetWorth: 'Враховувати в капіталі',
  hiddenFromNetWorth: 'Не враховується в капіталі',
  countsInNetWorth: (percent) => `${percent}% враховується в капіталі`,
  disconnect: 'Відключити',
  addPortfolio: 'Додати портфель',
  custom: 'Власний',
  showCard: (name) => `Показати ${name}`,
  synced: (ago) => `Синхронізовано ${ago}`,
  shareOf: (percent, total) => `${percent}% від ${total}`,
  live: 'Наживо',
  reconnecting: 'Перепідключення',
  confirmDeletePortfolio: (synced) =>
    synced ? ['Відключити', 'і видалити його синхронізовані записи?'] : ['Видалити', 'і всі його записи?'],
  confirmDeleteEntry: ['Видалити', '?'],

  ago: {
    now: 'щойно',
    minutes: (n) => `${n} хв тому`,
    hours: (n) => `${n} год тому`,
    days: (n) => `${n} дн тому`,
  },
  months: ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'],

  rowActions: 'Дії з рядком',
  edit: 'Редагувати',
  loadingEntries: 'Завантаження записів',
  empty: {
    noPortfolios: 'Створіть перший портфель кнопкою + над картками.',
    period: 'За цей період нічого немає.',
    noStocks: 'У цьому портфелі немає акцій.',
    noTransactions: 'Немає транзакцій за останні 31 день.',
    noEntries: 'Записів ще немає. Поповніть портфель, щоб побачити баланс.',
  },

  value: 'Вартість',
  loadingGraph: 'Завантаження графіка',

  deposit: 'Поповнити',
  withdraw: 'Зняти',
  entryTitle: (direction, type, editing) => {
    const label = uk.entryTypes[type]
    const action = direction === 'out' ? 'Зняття' : 'Поповнення'
    return editing ? `Редагувати ${action.toLowerCase()} · ${label}` : `${action} · ${label}`
  },

  renamePortfolio: 'Перейменувати портфель',
  newPortfolio: 'Новий портфель',

  percentages: 'Відсотки',
  cardShows: 'Картка показує',
  countsInNetWorthLabel: 'Враховується в капіталі',
  cardPercentError: 'Більше 0, до 100',
  netWorthPercentError: 'Від 0 до 100',
  partOf: (part, total) => `${part} з ${total}`,
  hiddenNote: 'Зараз не враховується в капіталі — увімкніть знову в меню картки.',

  monobank: {
    pickCard: 'Оберіть картку',
    connect: 'Підключити Monobank',
    intro: [
      'Відкрийте',
      ', відскануйте QR-код у застосунку Monobank і вставте сюди токен. Він може лише читати баланси й транзакції.',
    ],
    tokenLabel: 'Токен Monobank',
    noCards: 'На цьому рахунку немає карток.',
    cards: 'Картки',
    currencyNotSupported: 'Валюта поки не підтримується',
    unreachable: 'Не вдалося зʼєднатися з Monobank. Спробуйте ще раз.',
  },

  ibkr: {
    pickStocks: 'Оберіть акції',
    connect: 'Підключити Interactive Brokers',
    intro:
      'IBKR передає ваші акції через звіт лише для читання: він не може торгувати чи переказувати гроші. Налаштуйте один раз:',
    tokenLabel: 'Токен IBKR Flex',
    queryId: 'Query ID',
    queryIdLabel: 'Flex Query ID',
    preparing: 'IBKR готує звіт. Це може тривати до пів хвилини…',
    updates: 'Позиції оновлюються раз на день, ціни — кожні 30 секунд.',
    noStocks: 'На цьому рахунку немає акцій.',
    selectAll: 'Вибрати всі',
    picked: (n, of) => `${n} з ${of}`,
    stocks: 'Акції',
    priceUnavailable: 'Ціна недоступна',
    shares: 'шт.',
    followsNew: 'Нові акції, які ви купите, додаватимуться автоматично.',
    unreachable: 'Не вдалося зʼєднатися з Interactive Brokers. Спробуйте ще раз.',
  },
}

const DICTIONARIES: Record<Language, Dictionary> = { en, uk }

const listeners = new Set<() => void>()
let current: Language = DEFAULT

function apply(language: Language) {
  current = language
  document.documentElement.lang = language
  listeners.forEach((l) => l())
}

// The signed-in user's saved language; signing out goes back to the default.
const me = convex.watchQuery(api.users.me, {})
me.onUpdate(() => {
  let user
  try {
    user = me.localQueryResult()
  } catch {
    return
  }
  if (user === undefined) return // still loading
  const next = isLanguage(user?.language) ? user.language : DEFAULT
  if (next !== current) apply(next)
  // The sign-in page is English.
  if (!user) document.documentElement.lang = 'en'
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useLanguage = () => useSyncExternalStore(subscribe, () => current)

/** The texts in the current language; re-renders when it changes. */
export const useT = () => DICTIONARIES[useLanguage()]

/** The texts outside React (formatting, error messages). */
export const dict = () => DICTIONARIES[current]

/** Switches instantly, then saves it on the account; switches back if saving fails. */
export function setLanguage(language: Language) {
  convex
    .mutation(
      api.users.setLanguage,
      { language },
      {
        optimisticUpdate: (store) => {
          const user = store.getQuery(api.users.me, {})
          if (user) store.setQuery(api.users.me, {}, { ...user, language })
        },
      },
    )
    .catch((e) => console.error('Could not save language', e))
}
