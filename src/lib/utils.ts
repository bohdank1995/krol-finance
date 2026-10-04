export { cn } from "cn"

/** Keeps browsers and password managers from filling a field (they ignore autoComplete="off" on
    password fields, and treat a password field + a text field as a login form). */
export const noAutofill = {
  autoComplete: 'off',
  spellCheck: false,
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-bwignore': true,
  'data-form-type': 'other',
} as const

/** Shows typed text as dots without being a password field (so nothing gets autofilled into it). */
export const masked = '[-webkit-text-security:disc]'
