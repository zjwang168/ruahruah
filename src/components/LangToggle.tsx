'use client'

import { LOCALES, LOCALE_LABEL } from '@/lib/i18n/config'
import { useI18n } from '@/lib/i18n/provider'

/**
 * Two-state language switch. A segmented control rather than a dropdown: with
 * exactly two locales a <select> costs a click and hides the alternative.
 *
 * Both labels are always rendered in their OWN language ("EN" / "中文") — a
 * reader who cannot read the current locale still recognises the one they
 * want, which is the whole job of this control.
 */
export default function LangToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()

  return (
    <div
      role="group"
      aria-label={t('lang.switchTo')}
      className={`inline-flex shrink-0 items-center rounded-full border border-gray-200 bg-white/70 p-0.5 ${className}`}
    >
      {LOCALES.map(code => {
        const active = code === locale
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={active}
            lang={code === 'zh' ? 'zh-CN' : 'en'}
            className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap transition ${
              active
                ? 'bg-[#7FB3FF] text-white'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {LOCALE_LABEL[code]}
          </button>
        )
      })}
    </div>
  )
}
