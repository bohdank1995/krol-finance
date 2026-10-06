import Google from '@auth/core/providers/google'
import { convexAuth } from '@convex-dev/auth/server'

/* Sign-in with Google. Its keys live in the Convex deployment's environment
   (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET); see convex/README.md. */

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
})
