import type { CaptureResult, PostHog } from 'posthog-js'

/* Anonymous usage statistics through PostHog: page views and the sign-in event below, and nothing else.
   No cookies, no user profiles and no session recording. Never send names, emails, amounts, assets or
   portfolio names, and update the privacy policy (`legal.tsx`) if what's collected changes.
   Off without VITE_POSTHOG_KEY, so local work doesn't count as visits. */

const KEY = import.meta.env.VITE_POSTHOG_KEY
const HOST = import.meta.env.VITE_POSTHOG_HOST

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

export function track(event: 'sign_in_started') {
  if (!KEY) return
  void load()
    .then((posthog) => posthog.capture(event))
    .catch(() => {})
}
