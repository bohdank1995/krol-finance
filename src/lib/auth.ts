import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** `undefined` while the stored session is still loading, `null` when signed out. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  return session
}

export function signInWithEmail(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    // Creates the account on first use; close sign-ups in the dashboard afterwards.
    options: { emailRedirectTo: window.location.origin },
  })
}

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
}

export function signOut() {
  return supabase.auth.signOut()
}
