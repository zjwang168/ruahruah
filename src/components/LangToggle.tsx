'use client'

import { LOCALES, LOCALE_LABEL, HTML_LANG, type Locale } from '@/lib/i18n/config'
import { useI18n } from '@/lib/i18n/provider'

/**
 * Language switch.
 *
 * A native <select> rather than the segmented control this used to be. Two
 * labels fit the nav row; three do not. Measured on a 360px phone, the row has
 * roughly 328px of usable width and already carries the wordmark, Sign in and
 * Get started — a third segment pushed the control to about 124px and the
 * wordmark wrapped underneath it, which is the exact failure the nav was fixed
 * for once already. The picker holds at about 64px no matter how many locales
 * are added.
 *
 * Native rather than a custom menu on purpose: this is the one control a
 * visitor who cannot read the current language has to be able to operate. The
 * platform picker is already localised, keyboard accessible, announced by
 * screen readers, and on a phone it opens as a sheet instead of a dropdown
 * that can fall off the edge of the viewport.
 *
 * Every option is labelled in its OWN language — EN / 中文 / ES — so a reader
 * recognises the one they want without reading the current one, and each
 * carries its lang attribute so the label is announced in the right voice.
 * That attribute comes from HTML_LANG, not from a comparison against 'zh':
 * the old binary would have labelled Spanish as English.
 */
export default function LangToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()

  return (
    <div
      className={`relative inline-flex shrink-0 items-center rounded-full border border-gray-200 bg-white/70 ${className}`}
    >
      <select
        aria-label={t('lang.switchTo')}
        value={locale}
        onChange={e => setLocale(e.target.value as Locale)}
        lang={HTML_LANG[locale]}
        className="appearance-none cursor-pointer rounded-full bg-transparent py-1 pl-3 pr-7 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]"
      >
        {LOCALES.map(code => (
          <option key={code} value={code} lang={HTML_LANG[code]}>
            {LOCALE_LABEL[code]}
          </option>
        ))}
      </select>

      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-2 h-3 w-3 text-gray-400"
      >
        <path
          d="M6 8l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
