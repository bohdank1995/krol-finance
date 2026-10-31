import { useAuthActions } from '@convex-dev/auth/react'

/* Sign-in through Convex Auth: Google comes back to this page signed in after its consent
   screen. The first sign-in creates the account. */

export function useSignInWithGoogle() {
  const { signIn } = useAuthActions()
  return () => signIn('google')
}

export const useSignOut = () => useAuthActions().signOut

/** True with a saved session, or when coming back from Google with a sign-in code. */
export function mayBeSignedIn() {
  if (new URLSearchParams(window.location.search).has('code')) return true
  try {
    return Object.keys(localStorage).some((key) => key.startsWith('__convexAuthJWT'))
  } catch {
    return false
  }
}
