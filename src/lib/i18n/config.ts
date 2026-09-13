// Locale plumbing shared by server and client. No React, no 'use client' —
// src/app/layout.tsx (a server component), src/proxy.ts (the edge proxy) and
// the client provider all import this, so it must stay importable anywhere.

export const LOCALES = ['en', 'zh', 'es'] as const
export type Locale = (typeof LOCALES)[number]

// The fallback when we know NOTHING about the visitor — no cookie, no usable
// Accept-Language. It is not "the default experience": a browser asking for
// Chinese gets Chinese on the first byte, see resolveLocale below.
export const DEFAULT_LOCALE: Locale = 'en'

// Locale lives in a cookie, not localStorage. layout.tsx is a server component
// and has to know the locale before the first byte in order to stamp
// <html lang>; localStorage is client-only, so the page would render as `en`
// and then flip. A cookie is readable in both places.
export const LOCALE_COOKIE = 'ruah_locale'

// One year. Nothing about a language choice needs to expire sooner.
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// ?lang=zh on any URL pins the language and persists it. This is what a link
// pasted into a WeChat group carries: the reader may never find a toggle, and
// the group already tells you which language they read in. The proxy strips
// the param after writing the cookie so the address bar stays clean and the
// choice survives the next click.
export const LOCALE_QUERY_PARAM = 'lang'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/**
 * Best locale for an Accept-Language header, or null if it asks for nothing we
 * speak. Highest q wins; equal q keeps the order the browser sent (Array#sort
 * is stable), which is the order the reader ranked them in.
 *
 * Only the primary subtag is matched, so every regional variant collapses onto
 * the locale we carry: zh-TW and zh-HK get Simplified Chinese, es-MX, es-419
 * and es-US all get the one Spanish. The wrong region is far closer to readable
 * than the wrong language, and the switch is one tap away.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (typeof header !== 'string' || header.trim().length === 0) return null

  const ranked = header
    .split(',')
    .map(part => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.map(p => p.trim()).find(p => p.startsWith('q='))
      // A malformed q ("q=high") is dropped rather than treated as 1 — a header
      // we cannot parse should not outrank one we can.
      const quality = q === undefined ? 1 : Number.parseFloat(q.slice(2))
      return { tag: tag.trim().toLowerCase(), quality }
    })
    .filter(entry => entry.tag.length > 0 && Number.isFinite(entry.quality) && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality)

  for (const { tag } of ranked) {
    // "*" means "anything" — it tells us nothing, so keep looking.
    if (tag === '*') continue
    const primary = tag.split('-')[0]
    if (isLocale(primary)) return primary
  }

  return null
}

/**
 * The one place that decides what language a request renders in.
 *
 * Order: an explicit choice (the cookie, written by the toggle or by ?lang=)
 * beats what the browser asked for, which beats the fallback. A visitor who
 * tapped EN stays on EN even on a Chinese-configured browser.
 */
export function resolveLocale({
  cookie,
  acceptLanguage,
}: {
  cookie?: string | null
  acceptLanguage?: string | null
}): Locale {
  if (isLocale(cookie)) return cookie
  return localeFromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE
}

// What goes in <html lang>. Screen readers and the browser's own translation
// prompt key off this, so it has to be a real BCP-47 tag, not our short code.
export const HTML_LANG: Record<Locale, string> = {
  en: 'en',
  zh: 'zh-CN',
  // es-US, not es: the copy is written for Spanish speakers in the United
  // States, and the tag is what a screen reader and the browser's own
  // translation prompt key off.
  es: 'es-US',
}

// og:locale wants the underscored POSIX-ish form, not the BCP-47 one. This is
// what WeChat, WhatsApp and the rest read off a shared link.
export const OG_LOCALE: Record<Locale, string> = {
  en: 'en_US',
  zh: 'zh_CN',
  es: 'es_US',
}

export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'EN',
  zh: '中文',
  es: 'ES',
}
