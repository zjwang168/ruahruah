'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import {
  DEFAULT_LOCALE,
  HTML_LANG,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  normalizeLocale,
  type Locale,
} from './config'
import { DICT, type MessageKey } from './dict'

/** Values substituted into a string's {placeholders}. */
export type TVars = Record<string, string | number>
export type TFn = (key: MessageKey, vars?: TVars) => string

type I18nValue = {
  locale: Locale
  t: TFn
  setLocale: (next: Locale) => void
}

const I18nContext = createContext<I18nValue | null>(null)

/**
 * Wraps the tree with the locale the SERVER already resolved from the cookie,
 * so the first render is already in the right language — no flash of English.
 *
 * Switching is deliberately NOT a router.refresh(): the whole string table is
 * already in the client bundle, so flipping a useState re-renders everything
 * instantly and offline. The cookie write is only for the NEXT page load, and
 * <html lang> is updated by hand because React does not own that attribute.
 */
export function I18nProvider({
  locale: initialLocale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
}) {
  const [locale, setLocaleState] = useState<Locale>(normalizeLocale(initialLocale))

  const setLocale = useCallback((next: Locale) => {
    const value = normalizeLocale(next)
    setLocaleState(value)
    document.cookie =
      `${LOCALE_COOKIE}=${value}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`
    document.documentElement.lang = HTML_LANG[value]
  }, [])

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      // Falling back to the key rather than to English is on purpose: a missing
      // string shows up as `home.cta.title` in the page, which is obvious in a
      // screenshot. Silently serving English would hide it. The Record<> type
      // on `zh` should make this unreachable anyway.
      //
      // {placeholders} are substituted rather than concatenated at the call
      // site, because word order is not a constant: "5 total" is "共 5 条" in
      // Chinese, with the number in the middle. An unknown placeholder is left
      // as-is so it shows up in the page instead of vanishing.
      t: (key: MessageKey, vars?: TVars) => {
        const raw = DICT[locale]?.[key] ?? DICT[DEFAULT_LOCALE][key] ?? key
        if (!vars) return raw
        return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
          name in vars ? String(vars[name]) : whole
        )
      },
    }),
    [locale, setLocale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used inside <I18nProvider> (it lives in app/layout.tsx)')
  }
  return ctx
}

/** Shorthand for the common case. `const t = useT()` then `t('nav.signin')`. */
export function useT(): TFn {
  return useI18n().t
}
