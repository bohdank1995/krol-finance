import { useAuthActions } from '@convex-dev/auth/react'

/* Sign-in through Convex Auth: Google comes back to this page signed in after its consent
   screen. The first sign-in creates the account. */

export function useSignInWithGoogle() {
  const { signIn } = useAuthActions()
  return () => signIn('google')
}

export const useSignOut = () => useAuthActions().signOut
