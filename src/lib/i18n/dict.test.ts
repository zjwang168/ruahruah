import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DICT, en, zh, type MessageKey } from './dict.ts'
import {
  LOCALES,
  DEFAULT_LOCALE,
  isLocale,
  normalizeLocale,
  HTML_LANG,
  OG_LOCALE,
  localeFromAcceptLanguage,
  resolveLocale,
} from './config.ts'

// The Record<MessageKey, string> annotation on `zh` already makes a MISSING key
// a type error. These cover what the type cannot: a key present but empty, a
// key that exists only in zh, and copy that was pasted across without being
// translated. `npm test` runs them.

describe('i18n dictionary', () => {
  it('every locale carries exactly the same keys as en', () => {
    // Iterates LOCALES rather than naming the locales, so adding a fourth
    // language is covered the moment it is added to the list.
    const enKeys = Object.keys(en).sort()

    for (const locale of LOCALES) {
      const keys = Object.keys(DICT[locale]).sort()
      const missing = enKeys.filter(k => !keys.includes(k))
      const extra = keys.filter(k => !enKeys.includes(k))

      assert.deepEqual(missing, [], `missing from ${locale}: ${missing.join(', ')}`)
      assert.deepEqual(extra, [], `in ${locale} but not en: ${extra.join(', ')}`)
    }
  })

  it('no string is empty or whitespace-only in any locale', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(DICT[locale])) {
        assert.equal(typeof value, 'string', `${locale}.${key} is not a string`)
        assert.ok(value.trim().length > 0, `${locale}.${key} is empty`)
      }
    }
  })

  it('every translated string that should differ from en actually does', () => {
    // Add a key here only when the locales are legitimately the same string —
    // a brand name, a bare symbol, a proper noun. Everything else being
    // identical means the English was pasted in and never translated.
    const ALLOWED_IDENTICAL = new Set<string>([
      // The name on the hero mockup card. Same name in every locale by design.
      'home.card.matchName',
    ])

    for (const locale of LOCALES) {
      if (locale === 'en') continue

      const untranslated = Object.keys(en).filter(
        k =>
          !ALLOWED_IDENTICAL.has(k) &&
          DICT[locale][k as MessageKey] === en[k as keyof typeof en]
      )

      assert.deepEqual(
        untranslated,
        [],
        `${locale}: identical to the English, so probably untranslated: ${untranslated.join(', ')}`
      )
    }
  })

  it('every locale carries the same {placeholders} as the English', () => {
    // A translation that drops {count} renders a sentence with a hole in it,
    // and one that invents {name} renders the brace. Neither shows up in a
    // type check.
    const holes = (v: string) => (v.match(/\{\w+\}/g) ?? []).sort().join(',')

    for (const locale of LOCALES) {
      if (locale === 'en') continue
      const wrong = Object.keys(en).filter(
        k => holes(DICT[locale][k as MessageKey]) !== holes(en[k as keyof typeof en])
      )
      assert.deepEqual(wrong, [], `${locale}: placeholders differ from en: ${wrong.join(', ')}`)
    }
  })

  it('every zh string actually contains Chinese', () => {
    // Catches the other half of the same mistake: a string that was edited but
    // is still Latin-only. Keys whose value is deliberately symbolic (emoji,
    // punctuation, a proper noun) are exempt.
    //
    // There is no equivalent script check for Spanish — it shares the Latin
    // alphabet with the English, so the "differs from en" test above is the
    // only automatic signal there.
    const EXEMPT = new Set<string>(['home.card.matchName'])
    const HAN = /\p{Script=Han}/u

    const noHan = Object.keys(zh).filter(
      k => !EXEMPT.has(k) && !HAN.test(zh[k as keyof typeof en])
    )

    assert.deepEqual(noHan, [], `zh value has no Chinese characters: ${noHan.join(', ')}`)
  })
})

describe('i18n config', () => {
  it('the default locale is one of the supported locales', () => {
    assert.ok(LOCALES.includes(DEFAULT_LOCALE))
  })

  it('every locale has an html lang tag and an og:locale', () => {
    for (const locale of LOCALES) {
      assert.ok(HTML_LANG[locale], `no HTML_LANG for ${locale}`)
      assert.ok(OG_LOCALE[locale], `no OG_LOCALE for ${locale}`)
    }
  })

  it('isLocale accepts supported codes and rejects everything else', () => {
    for (const locale of LOCALES) assert.equal(isLocale(locale), true)
    for (const bad of ['fr', '', 'ZH', 'en-US', null, undefined, 7, {}]) {
      assert.equal(isLocale(bad), false, `isLocale(${JSON.stringify(bad)}) should be false`)
    }
  })

  it('normalizeLocale falls back rather than throwing on junk', () => {
    // The cookie is attacker-controllable — it must never be trusted into an
    // index without passing through here first.
    assert.equal(normalizeLocale('zh'), 'zh')
    assert.equal(normalizeLocale('fr'), DEFAULT_LOCALE)
    assert.equal(normalizeLocale(undefined), DEFAULT_LOCALE)
    assert.equal(normalizeLocale('__proto__'), DEFAULT_LOCALE)
    assert.equal(normalizeLocale({ toString: () => 'zh' }), DEFAULT_LOCALE)
  })
})

describe('locale negotiation', () => {
  it('reads the language a browser actually asked for', () => {
    assert.equal(localeFromAcceptLanguage('zh-CN,zh;q=0.9,en;q=0.8'), 'zh')
    assert.equal(localeFromAcceptLanguage('en-US,en;q=0.9'), 'en')
    assert.equal(localeFromAcceptLanguage('zh'), 'zh')
  })

  it('ranks by q, not by position', () => {
    assert.equal(localeFromAcceptLanguage('en;q=0.4,zh;q=0.9'), 'zh')
    assert.equal(localeFromAcceptLanguage('zh;q=0.2,en;q=0.7'), 'en')
  })

  it('maps every Chinese variant onto our one Chinese locale', () => {
    // Simplified is what we have. A Traditional reader gets the right
    // language in the wrong script, which beats the wrong language.
    for (const tag of ['zh-TW', 'zh-HK', 'zh-Hant', 'zh-hans-cn']) {
      assert.equal(localeFromAcceptLanguage(tag), 'zh', tag)
    }
  })

  it('maps every Spanish variant onto our one Spanish locale', () => {
    // The copy is written for the United States, but a Mexican, Argentine or
    // Latin-American-generic header is still a Spanish reader.
    for (const tag of ['es-MX', 'es-419', 'es-AR', 'es-us']) {
      assert.equal(localeFromAcceptLanguage(tag), 'es', tag)
    }
  })

  it('returns null when the header asks for nothing we speak', () => {
    // 'es' used to be the example of a language we do not speak. It is a
    // supported locale now, so the fixture moved to German.
    for (const header of ['fr-FR,fr;q=0.9', 'de', '*', '', '   ', null, undefined]) {
      assert.equal(localeFromAcceptLanguage(header), null, JSON.stringify(header))
    }
  })

  it('ignores a language the browser explicitly refused (q=0)', () => {
    assert.equal(localeFromAcceptLanguage('zh;q=0,en;q=0.5'), 'en')
  })

  it('does not let an unparseable q outrank a real one', () => {
    assert.equal(localeFromAcceptLanguage('en;q=high,zh;q=0.9'), 'zh')
  })

  it('prefers an explicit choice over what the browser asked for', () => {
    // Someone on a Chinese-configured browser who tapped EN stays on EN.
    assert.equal(resolveLocale({ cookie: 'en', acceptLanguage: 'zh-CN,zh;q=0.9' }), 'en')
    assert.equal(resolveLocale({ cookie: 'zh', acceptLanguage: 'en-US' }), 'zh')
  })

  it('falls back to the header, then to the default', () => {
    assert.equal(resolveLocale({ acceptLanguage: 'zh-CN,zh;q=0.9' }), 'zh')
    assert.equal(resolveLocale({ acceptLanguage: 'fr-FR' }), DEFAULT_LOCALE)
    assert.equal(resolveLocale({}), DEFAULT_LOCALE)
  })

  it('never trusts a junk cookie into the dictionary', () => {
    // The cookie is attacker-controllable and indexes DICT downstream.
    assert.equal(resolveLocale({ cookie: '__proto__', acceptLanguage: 'zh' }), 'zh')
    assert.equal(resolveLocale({ cookie: 'ZH', acceptLanguage: 'fr' }), DEFAULT_LOCALE)
  })
})
