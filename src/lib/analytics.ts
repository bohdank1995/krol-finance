import type { CaptureResult, PostHog } from 'posthog-js'

/* Usage statistics through PostHog: page views, the sign-in events and `dashboard_viewed` below, and nothing
   else. No cookies and no session recording. Visitors stay anonymous; once signed in, events carry a random-looking
   ID made from the account (`identifyUser`), so activation and retention can be counted per person. Never send
   names, emails, amounts, assets or portfolio names, and update the privacy policy (`legal.tsx`) if what's
   collected changes. Off without POSTHOG_KEY, so local work doesn't count as visits. */

const KEY = import.meta.env.POSTHOG_KEY
const HOST = import.meta.env.POSTHOG_HOST

/** Addresses keep only their path: Google's sign-in code arrives in the query (`/?code=…`). */
function bare(value: unknown): unknown {
  if (typeof value === 'string') return /^https?:\/\//.test(value) ? value.replace(/[?#].*$/, '') : value
  if (Array.isArray(value)) return value.map(bare)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, bare(inner)]))
  return value
}

/* Where this visit came from: the link's utm_source, else the referring site, else "direct". Remembered
   for the tab, or coming back from Google would look like a new visit from Google. */
const VISIT_SOURCE = 'koshel:visit-source'

function readSource() {
  const tag = new URLSearchParams(window.location.search).get('utm_source')?.trim().toLowerCase()
  if (tag) return tag.slice(0, 50)
  const referrer = document.referrer && new URL(document.referrer).hostname.replace(/^www\./, '')
  return referrer && referrer !== window.location.hostname.replace(/^www\./, '') ? referrer : 'direct'
}

function visitSource() {
  try {
    const source = sessionStorage.getItem(VISIT_SOURCE) ?? readSource()
    sessionStorage.setItem(VISIT_SOURCE, source)
    return source
  } catch {
    return readSource()
  }
}

let client: Promise<PostHog> | undefined

function load() {
  client ??= import('posthog-js').then(({ posthog }) => {
    const source = visitSource()
    posthog.init(KEY!, {
      api_host: HOST,
      cookieless_mode: 'always',
      // Profiles only for signed-in people, keyed by the scrambled account ID: no name, email or amounts.
      person_profiles: 'identified_only',
      // The same `source` on page views and sign-ups lets one chart split both by it.
      before_send: (event) =>
        event && { ...event, properties: { ...(bare(event.properties) as CaptureResult['properties']), source } },
      // Clicks and recordings could pick up balances from the screen. Each one is off here, and scripts
      // can't load from PostHog, so a switch in its dashboard can't turn them on.
      autocapture: false,
      rageclick: false,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      capture_exceptions: false,
      capture_performance: false,
      disable_session_recording: true,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
      disable_surveys: true,
      disable_product_tours: true,
      disable_conversations: true,
      disable_web_experiments: true,
    })
    return posthog
  })
  return client
}

/** Starts after the page has loaded, so it never slows the first view. */
export function startAnalytics() {
  if (!KEY) return
  const start = () => void load().catch(() => {})
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}

type Event = 'google_button_clicked' | 'sign_up' | 'login' | 'dashboard_viewed'

/** Set once the account is known, so its events wait for the ID instead of going out anonymous. */
let identified: Promise<unknown> = Promise.resolve()

function track(event: Event, properties?: Record<string, number>) {
  if (!KEY) return
  void Promise.all([load(), identified])
    .then(([posthog]) => posthog.capture(event, properties))
    .catch(() => {})
}

/** The account's database ID, scrambled (SHA-256): the same person on every visit, but nothing that names them. */
async function scramble(accountId: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`koshel:${accountId}`))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

let identifiedAs: string | undefined

/** Call once the signed-in account is known: its later events count as one person in PostHog. The first source
    seen is kept on the person, so activation and retention can be split by where people came from. */
export function identifyUser(accountId: string) {
  // No ID yet (a server without this field): stay anonymous rather than lump everyone into one person.
  if (!KEY || !accountId || identifiedAs === accountId) return
  identifiedAs = accountId
  identified = Promise.all([load(), scramble(accountId)])
    .then(([posthog, id]) => posthog.identify(id, undefined, { first_source: visitSource() }))
    .catch(() => {})
}

/* Opening the dashboard: once per page load, and again after the tab has been away a while. Carries only how
   many assets hold at least one transaction: activation is 2+ within 7 days of sign-up, retention is coming
   back 8–14 days later. */
const VIEW_GAP_MS = 30 * 60 * 1000
let lastView = { at: 0, assets: 0 }

/** Also sent right away when the count grows, so reaching 2 assets counts without waiting for the next visit. */
export function trackDashboardViewed(assetsWithData: number) {
  if (Date.now() - lastView.at < VIEW_GAP_MS && assetsWithData <= lastView.assets) return
  lastView = { at: Date.now(), assets: assetsWithData }
  track('dashboard_viewed', { assets_with_data: assetsWithData })
}

/* The browser leaves for Google mid sign-in, so this note carries the attempt across the trip. Only a
   sign-in that started here counts: people with a saved session aren't signing in again on every visit. */
const SIGN_IN_PENDING = 'koshel:sign-in-pending'
/** An account this young was made by the sign-in that just finished: a sign-up, not a login. */
const NEW_ACCOUNT_MS = 10 * 60 * 1000

export function trackGoogleButtonClicked() {
  track('google_button_clicked')
  try {
    sessionStorage.setItem(SIGN_IN_PENDING, '1')
  } catch {
    // Blocked storage only loses the completed event.
  }
}

/** Call once the account is known. Does nothing unless a sign-in is pending in this tab. */
export function trackSignedIn(accountCreatedAt: number) {
  try {
    if (!sessionStorage.getItem(SIGN_IN_PENDING)) return
    sessionStorage.removeItem(SIGN_IN_PENDING)
  } catch {
    return
  }
  track(Date.now() - accountCreatedAt < NEW_ACCOUNT_MS ? 'sign_up' : 'login')
}
