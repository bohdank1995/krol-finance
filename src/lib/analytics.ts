import type { CaptureResult, PostHog } from 'posthog-js'

/* Anonymous usage statistics through PostHog: page views and the sign-in events below, and nothing else.
   No cookies, no user profiles and no session recording. Never send names, emails, amounts, assets or
   portfolio names, and update the privacy policy (`legal.tsx`) if what's collected changes.
   Off without POSTHOG_KEY, so local work doesn't count as visits. */

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

const withoutQueries = (event: CaptureResult | null) =>
  event && { ...event, properties: bare(event.properties) as CaptureResult['properties'] }

let client: Promise<PostHog> | undefined

function load() {
  client ??= import('posthog-js').then(({ posthog }) => {
    posthog.init(KEY!, {
      api_host: HOST,
      cookieless_mode: 'always',
      person_profiles: 'never',
      before_send: withoutQueries,
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

function track(event: 'sign_in_started' | 'sign_in_completed' | 'sign_up_completed') {
  if (!KEY) return
  void load()
    .then((posthog) => posthog.capture(event))
    .catch(() => {})
}

/* The browser leaves for Google mid sign-in, so this note carries the attempt across the trip. Only a
   sign-in that started here counts: people with a saved session aren't signing in again on every visit. */
const SIGN_IN_PENDING = 'koshel:sign-in-pending'
/** An account this young was made by the sign-in that just finished. */
const NEW_ACCOUNT_MS = 10 * 60 * 1000

export function trackSignInStarted() {
  track('sign_in_started')
  try {
    sessionStorage.setItem(SIGN_IN_PENDING, '1')
  } catch {
    // Blocked storage only loses the completed event.
  }
}

/** Call once the account is known. Does nothing unless a sign-in is pending in this tab. */
export function trackSignInCompleted(accountCreatedAt: number) {
  try {
    if (!sessionStorage.getItem(SIGN_IN_PENDING)) return
    sessionStorage.removeItem(SIGN_IN_PENDING)
  } catch {
    return
  }
  track('sign_in_completed')
  if (Date.now() - accountCreatedAt < NEW_ACCOUNT_MS) track('sign_up_completed')
}
