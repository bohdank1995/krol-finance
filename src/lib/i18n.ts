import { useSyncExternalStore } from 'react'
import type { EntryType } from './assets'
import type { Preset, Unit } from './period'
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
  portfolio: 'Source',
  token: 'Token',
  somethingWrong: 'Something went wrong. Try again.',
  alreadyConnected: 'Already connected',

  account: 'Account',
  currency: 'Currency',
  language: 'Language',
  fakeNumbers: 'Fake numbers',
  fakeNumbersHint: 'Random values, safe to share',
  fakeNumbersOn: 'Fake numbers on',
  logOut: 'Log out',
  deleteAccount: 'Delete account',
  confirmDeleteAccount: 'Delete your account and all its data, including connected Monobank and IBKR tokens? This can’t be undone.',
  deleteAccountFailed: 'Could not delete the account. Try again.',

  period: 'Period',
  periods: {
    today: 'Today',
    yesterday: 'Yesterday',
    'last-hour': 'Last hour',
    'last-24-hours': 'Last 24 hours',
    'last-7-days': 'Last 7 days',
    'last-14-days': 'Last 14 days',
    'last-30-days': 'Last 30 days',
    'last-90-days': 'Last 90 days',
    'last-180-days': 'Last 180 days',
    'last-week': 'Last week',
    'last-month': 'Last month',
    'this-week': 'This week',
    'this-month': 'This month',
    'this-year': 'This year',
    all: 'All time',
  } satisfies Record<Preset, string>,
  inTheLast: 'In the last',
  /** Unit names for "In the last N …", by count. */
  units: (unit: Unit, n: number) => (n === 1 ? unit.slice(0, -1) : unit),
  /** The picker's label for a custom "In the last N …". */
  lastN: (n: number, units: string) => `Last ${n} ${units}`,
  fewer: 'Fewer',
  more: 'More',

  entryTypes: { money: 'Money', crypto: 'Crypto', stocks: 'Stocks' } satisfies Record<EntryType, string>,
  soon: 'soon',
  /** Overrides for asset names in the asset picker. */
  assetNames: {} as Record<string, string>,

  netWorth: 'Net worth',
  passiveIncome: 'Passive income',
  portfolios: 'Sources',
  portfolioActions: (name: string) => `${name} actions`,
  rename: 'Rename',
  editSources: 'Edit sources',
  selected: (n: number) => `${n} selected`,
  group: 'Group',
  ungroup: 'Ungroup',
  showCrypto: 'Show crypto prices',
  showCurrencies: 'Show currency rates',
  moveGroup: (name: string) => `Move ${name}`,
  groupCards: 'Group these cards',
  newGroup: 'New group',
  groupName: 'Group name',
  sourcesCount: (n: number) => `${n} sources`,
  removeSource: (name: string) => `Remove ${name}`,
  removeFromGroup: (name: string) => `Take ${name} out of the group`,
  confirmDeleteMany: (n: number) => `Delete ${n} sources and all their transactions? Connected ones are disconnected.`,
  setPercentages: 'Set your share',
  hideFromNetWorth: 'Do not include in Net Worth',
  showInNetWorth: 'Include in Net Worth',
  hiddenFromNetWorth: 'Not included in Net Worth',
  hideFromPassive: (name: string) => `Leave ${name} out of passive income`,
  showInPassive: (name: string) => `Count ${name} in passive income`,
  hide: 'Hide',
  useResult: 'Use the result (Tab)',
  enterIn: (unit: string) => `Enter the amount in ${unit}`,
  show: 'Show',
  removeStock: 'Remove stock',
  /** Text before and after the stock in the remove confirmation. */
  confirmRemoveStock: ['Remove', 'and all its transactions from this source? Syncs won’t add it back.'],
  countsInNetWorth: (percent: number) => `${percent}% counts in net worth`,
  disconnect: 'Disconnect',
  addPortfolio: 'Add source',
  custom: 'Manual source',
  showCard: (name: string) => `Show ${name}`,
  synced: (ago: string) => `Synced ${ago}`,
  shareOf: (percent: number, total: string) => `${percent}% of ${total}`,
  live: 'Live',
  reconnecting: 'Reconnecting',
  /** Text before and after the portfolio's name in the delete confirmation. */
  confirmDeletePortfolio: (synced: boolean) =>
    synced ? ['Disconnect', 'and remove its synced transactions?'] : ['Delete', 'and all its transactions?'],
  confirmDeleteEntry: ['Delete', '?'],

  ago: {
    now: 'just now',
    minutes: (n: number) => `${n}m ago`,
    hours: (n: number) => `${n}h ago`,
    days: (n: number) => `${n}d ago`,
  },
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

  rowActions: 'Row actions',
  showMore: (n: number) => `Show ${n} more`,
  left: (n: number) => `${n} left`,
  edit: 'Edit',
  empty: {
    noPortfolios: 'Create your first source with the + button above.',
    period: 'Nothing in this period.',
    noStocks: 'No stocks in this source.',
    noTransactions: 'No transactions in the last 31 days.',
    noEntries: 'No transactions yet. Make a deposit to see a balance.',
  },

  value: 'Value',
  assetsTab: 'Assets',
  transactionsTab: 'Transactions',
  payouts: 'Dividends and interest',
  noAssets: 'Nothing held in this period.',
  paid: 'Paid',
  loadingGraph: 'Loading graph',

  deposit: 'Deposit',
  withdraw: 'Withdraw',
  entryTitle: (direction: 'in' | 'out', type: EntryType, editing: boolean) => {
    const label = en.entryTypes[type].toLowerCase()
    if (editing) return `Edit ${label} ${direction === 'out' ? 'withdrawal' : 'deposit'}`
    return `${direction === 'out' ? 'Withdraw' : 'Deposit'} ${label}`
  },

  renamePortfolio: 'Rename source',
  renameGroup: 'Rename group',
  groupActions: (name: string) => `Actions for ${name}`,
  newPortfolio: 'New source',

  percentages: 'Your share',
  cardShows: 'Your share of this source',
  cardPercentError: 'Above 0, up to 100',
  partOf: (part: string, total: string) => `${part} of ${total}`,
  hiddenNote: 'Not included in Net Worth for now — include it again from the ⋯ menu.',

  monobank: {
    pickCards: 'Pick cards',
    connect: 'Connect Monobank',
    /** Text before and after the api.monobank.ua link. */
    intro: [
      'Open',
      ', scan the QR code with the Monobank app, then paste the token here. It can only read balances and transactions.',
    ],
    tokenLabel: 'Monobank token',
    noCards: 'No cards found on this account.',
    cards: 'Cards',
    historyNote: 'Balances appear right away. Transactions load one card per minute.',
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
    syncNow: 'Sync now',
    syncing: 'Syncing…',
    updated: 'Updated',
    loadingHistory: 'Loading purchase history…',
    noTrades:
      'Purchase dates will be missing: your Flex Query has no Trades section. Add it in IBKR (tick Select all, choose Execution), then open this again.',
  },
}

export type Dictionary = typeof en

/** Ukrainian plural form of a count: 0 = один день, 1 = два дні, 2 = п'ять днів. */
function ukPlural(n: number) {
  const form = new Intl.PluralRules('uk').select(n)
  return form === 'one' ? 0 : form === 'few' ? 1 : 2
}

const UK_UNITS: Record<Unit, [string, string, string]> = {
  days: ['день', 'дні', 'днів'],
  weeks: ['тиждень', 'тижні', 'тижнів'],
  months: ['місяць', 'місяці', 'місяців'],
  years: ['рік', 'роки', 'років'],
}

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
  portfolio: 'Джерело',
  token: 'Токен',
  somethingWrong: 'Щось пішло не так. Спробуйте ще раз.',
  alreadyConnected: 'Уже підключено',

  account: 'Акаунт',
  currency: 'Валюта',
  language: 'Мова',
  fakeNumbers: 'Вигадані числа',
  fakeNumbersHint: 'Безпечно для скриншотів',
  fakeNumbersOn: 'Вигадані числа увімкнено',
  logOut: 'Вийти',
  deleteAccount: 'Видалити акаунт',
  confirmDeleteAccount: 'Видалити акаунт і всі його дані, разом із підключеними токенами Monobank та IBKR? Це не можна скасувати.',
  deleteAccountFailed: 'Не вдалося видалити акаунт. Спробуйте ще раз.',

  period: 'Період',
  periods: {
    today: 'Сьогодні',
    yesterday: 'Вчора',
    'last-hour': 'Остання година',
    'last-24-hours': 'Останні 24 години',
    'last-7-days': 'Останні 7 днів',
    'last-14-days': 'Останні 14 днів',
    'last-30-days': 'Останні 30 днів',
    'last-90-days': 'Останні 90 днів',
    'last-180-days': 'Останні 180 днів',
    'last-week': 'Минулий тиждень',
    'last-month': 'Минулий місяць',
    'this-week': 'Цей тиждень',
    'this-month': 'Цей місяць',
    'this-year': 'Цей рік',
    all: 'Весь час',
  },
  inTheLast: 'За останні',
  units: (unit: Unit, n: number) => UK_UNITS[unit][ukPlural(n)],
  lastN: (n: number, units: string) => `${ukPlural(n) === 0 ? 'Останній' : 'Останні'} ${n} ${units}`,
  fewer: 'Менше',
  more: 'Більше',

  entryTypes: { money: 'Гроші', crypto: 'Крипта', stocks: 'Акції' },
  soon: 'скоро',
  assetNames: {
    USD: 'Долар США',
    EUR: 'Євро',
    UAH: 'Українська гривня',
    PLN: 'Польський злотий',
  },

  netWorth: 'Капітал',
  passiveIncome: 'Пасивний дохід',
  portfolios: 'Джерела',
  portfolioActions: (name) => `Дії: ${name}`,
  rename: 'Перейменувати',
  editSources: 'Редагувати джерела',
  selected: (n) => `Вибрано: ${n}`,
  group: 'Згрупувати',
  ungroup: 'Розгрупувати',
  showCrypto: 'Показати ціни криптовалют',
  showCurrencies: 'Показати курси валют',
  moveGroup: (name) => `Перемістити ${name}`,
  groupCards: 'Згрупувати ці картки',
  newGroup: 'Нова група',
  groupName: 'Назва групи',
  sourcesCount: (n) => `${n} ${['джерело', 'джерела', 'джерел'][ukPlural(n)]}`,
  removeSource: (name) => `Прибрати ${name}`,
  removeFromGroup: (name) => `Вийняти ${name} з групи`,
  confirmDeleteMany: (n) => `Видалити ${n} ${['джерело', 'джерела', 'джерел'][ukPlural(n)]} і всі їхні операції? Підключені буде відключено.`,
  setPercentages: 'Налаштувати вашу частку',
  hideFromNetWorth: 'Не враховувати в капіталі',
  showInNetWorth: 'Враховувати в капіталі',
  hiddenFromNetWorth: 'Не враховується в капіталі',
  hideFromPassive: (name) => `Не враховувати ${name} в пасивному доході`,
  showInPassive: (name) => `Враховувати ${name} в пасивному доході`,
  hide: 'Сховати',
  useResult: 'Підставити результат (Tab)',
  enterIn: (unit) => `Вводити суму в ${unit}`,
  show: 'Показати',
  removeStock: 'Прибрати акцію',
  confirmRemoveStock: ['Прибрати', 'і всі її операції з цього джерела? Синхронізація не додасть її знову.'],
  countsInNetWorth: (percent) => `${percent}% враховується в капіталі`,
  disconnect: 'Відключити',
  addPortfolio: 'Додати джерело',
  custom: 'Ручне джерело',
  showCard: (name) => `Показати ${name}`,
  synced: (ago) => `Синхронізовано ${ago}`,
  shareOf: (percent, total) => `${percent}% від ${total}`,
  live: 'Наживо',
  reconnecting: 'Перепідключення',
  confirmDeletePortfolio: (synced) =>
    synced ? ['Відключити', 'і видалити його синхронізовані операції?'] : ['Видалити', 'і всі його операції?'],
  confirmDeleteEntry: ['Видалити', '?'],

  ago: {
    now: 'щойно',
    minutes: (n) => `${n} хв тому`,
    hours: (n) => `${n} год тому`,
    days: (n) => `${n} дн тому`,
  },
  months: ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'],

  rowActions: 'Дії з рядком',
  showMore: (n) => `Показати ще ${n}`,
  left: (n) => `залишилось ${n}`,
  edit: 'Редагувати',
  empty: {
    noPortfolios: 'Створіть перше джерело кнопкою + вгорі.',
    period: 'За цей період нічого немає.',
    noStocks: 'У цьому джерелі немає акцій.',
    noTransactions: 'Немає операцій за останні 31 день.',
    noEntries: 'Операцій ще немає. Натисніть «Поповнити», щоб побачити баланс.',
  },

  value: 'Вартість',
  assetsTab: 'Активи',
  transactionsTab: 'Операції',
  payouts: 'Дивіденди та відсотки',
  noAssets: 'У цьому періоді активів не було.',
  paid: 'Сплачено',
  loadingGraph: 'Завантаження графіка',

  deposit: 'Поповнити',
  withdraw: 'Зняти',
  entryTitle: (direction, type, editing) => {
    const label = uk.entryTypes[type]
    const action = direction === 'out' ? 'Зняття' : 'Поповнення'
    return editing ? `Редагувати ${action.toLowerCase()} · ${label}` : `${action} · ${label}`
  },

  renamePortfolio: 'Перейменувати джерело',
  renameGroup: 'Перейменувати групу',
  groupActions: (name) => `Дії з ${name}`,
  newPortfolio: 'Нове джерело',

  percentages: 'Ваша частка',
  cardShows: 'Ваша частка цього джерела',
  cardPercentError: 'Більше 0, до 100',
  partOf: (part, total) => `${part} з ${total}`,
  hiddenNote: 'Зараз не враховується в капіталі — увімкніть знову в меню ⋯.',

  monobank: {
    pickCards: 'Оберіть картки',
    connect: 'Підключити Monobank',
    intro: [
      'Відкрийте',
      ', відскануйте QR-код у застосунку Monobank і вставте сюди токен. Він може лише читати баланси й транзакції.',
    ],
    tokenLabel: 'Токен Monobank',
    noCards: 'На цьому рахунку немає карток.',
    cards: 'Картки',
    historyNote: 'Баланси з’являться одразу. Транзакції завантажуються по одній картці на хвилину.',
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
    syncNow: 'Синхронізувати зараз',
    syncing: 'Синхронізація…',
    updated: 'Оновлено',
    loadingHistory: 'Завантаження історії покупок…',
    noTrades:
      'Дати покупок будуть відсутні: у вашому Flex Query немає розділу Trades. Додайте його в IBKR (позначте Select all, оберіть Execution), потім відкрийте це знову.',
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
