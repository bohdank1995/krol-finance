/* After a new release the old code files are gone, so a tab opened before it can't load the parts it
   loads later (the home page, the dashboard). Reloading fetches the new ones. */

const KEY = 'koshel:reloaded'

/** Use as `.catch(reloadOnce)` on a lazy import: reloads the page, at most once a minute. While it
    reloads the import never settles, so the loading screen stays up instead of a blank page. */
export function reloadOnce(error: unknown): Promise<never> {
  try {
    const last = Number(sessionStorage.getItem(KEY))
    if (!last || Date.now() - last > 60_000) {
      sessionStorage.setItem(KEY, String(Date.now()))
      window.location.reload()
      return new Promise(() => {})
    }
  } catch {
    // No session storage: don't risk a reload loop.
  }
  return Promise.reject(error)
}
