'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import LangToggle from '@/components/LangToggle'
import { useT } from '@/lib/i18n/provider'

/* Line icons, 24px grid, one stroke weight. They replaced a set of emoji:
   emoji render as someone else's artwork at someone else's weight, they do
   not take a colour, and a page built out of them reads as a template. */
const ICON = {
  chat: 'M20 12.5c0 3.6-3.6 6.5-8 6.5-1 0-2-.15-2.9-.43L4 20.5l1.5-3.4C4.55 15.9 4 14.5 4 12.9 4 9.3 7.6 6.4 12 6.4s8 2.9 8 6.1z',
  connect: 'M9.5 7.5H6.8A3.8 3.8 0 003 11.3v1.4a3.8 3.8 0 003.8 3.8h2.7M14.5 7.5h2.7A3.8 3.8 0 0121 11.3v1.4a3.8 3.8 0 01-3.8 3.8h-2.7M8.5 12h7',
  check: 'M20.5 12a8.5 8.5 0 11-2.6-6.1M21 5.5l-8.4 8.4-2.8-2.8',
  id: 'M3 5.5h18v13H3zM9 11.2a2.2 2.2 0 100 .1zM5.6 16.4c.7-1.5 2-2.2 3.4-2.2s2.7.7 3.4 2.2M15 10h4M15 13.5h3',
  lock: 'M4 10.5h16v10H4zM8 10.5V7.8a4 4 0 018 0v2.7M12 14.2v2.4',
} as const

function Icon({ path, className = '' }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  )
}

export default function Home() {
  const router = useRouter()
  const t = useT()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Keys only. The strings live in src/lib/i18n/dict.ts so both locales stay
  // side by side; the icons are not translatable and stay here.
  const steps = [
    { step: '01', icon: ICON.chat, title: 'home.how.1.title', desc: 'home.how.1.desc' },
    { step: '02', icon: ICON.connect, title: 'home.how.2.title', desc: 'home.how.2.desc' },
    { step: '03', icon: ICON.check, title: 'home.how.3.title', desc: 'home.how.3.desc' },
  ] as const

  const trust = [
    { icon: ICON.id, title: 'home.trust.identity.title', desc: 'home.trust.identity.desc' },
    { icon: ICON.lock, title: 'home.trust.docs.title', desc: 'home.trust.docs.desc' },
    { icon: ICON.chat, title: 'home.trust.record.title', desc: 'home.trust.record.desc' },
  ] as const

  return (
    <div className="min-h-screen bg-brand-wash font-sans">

      {/* NAV */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-surface/90 backdrop-blur shadow-card' : 'bg-transparent'}`}>
        {/* Four items on a 360px phone is the tightest row on the site, and the
            language switch — the one control a Chinese visitor arriving from a
            shared link needs — was the thing being crushed. Everything shrinks a
            step below sm and nothing is allowed to shrink into its neighbour. */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8 sm:w-9 sm:h-9" />
            <span className="text-lg sm:text-xl font-bold text-brand">Ruah！</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <LangToggle />
            <button onClick={() => router.push('/login')} className="text-sm text-ink-muted hover:text-ink transition whitespace-nowrap">
              {t('nav.signin')}
            </button>
            <button onClick={() => router.push('/onboarding/family')} className="bg-brand-gradient shadow-brand text-white px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full text-sm font-medium whitespace-nowrap transition hover:-translate-y-px">
              {t('nav.getStarted')}
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-brand-soft text-brand-strong text-xs font-medium px-3 py-1.5 rounded-full mb-6">
                {t('home.hero.badge')}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-ink leading-tight mb-6">
                {t('home.hero.line1')}<br />
                {t('home.hero.line2')}<br />
                <span className="text-brand">{t('home.hero.line3')}</span>
              </h1>
              <p className="text-ink-muted text-lg mb-8 leading-relaxed">
                {t('home.hero.sub')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => router.push('/onboarding/family')}
                  className="bg-brand-gradient shadow-brand text-white px-8 py-4 rounded-card font-semibold text-lg transition hover:-translate-y-px">
                  {t('home.hero.ctaFamily')}
                </button>
                <button onClick={() => router.push('/onboarding/caregiver')}
                  className="border-2 border-line-strong text-ink-muted px-8 py-4 rounded-card font-semibold text-lg hover:border-brand hover:text-brand transition">
                  {t('home.hero.ctaCaregiver')}
                </button>
              </div>
              <p className="text-ink-faint text-sm mt-4">{t('home.hero.assurances')}</p>
              <p className="text-ink-faint text-sm mt-3">
                {t('home.hero.humanPrompt')}{' '}
                <Link href="/concierge" className="text-brand-strong hover:underline">
                  {t('home.hero.humanLink')}
                </Link>
              </p>
            </div>

            {/* Hero Visual */}
            <div className="relative flex items-center justify-center">
              <div className="relative w-80 h-80">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-soft to-warm rounded-full opacity-60" />
                <div className="absolute inset-0 flex items-center justify-center animate-float">
                  <div className="text-center">
                    <div className="mb-4" style={{ filter: 'drop-shadow(0 8px 32px rgba(127,179,255,0.45))' }}>
                      <img src="/ruah-logo.png" alt="Ruah" className="w-36 h-36 mx-auto" />
                    </div>
                    <div className="bg-surface/80 backdrop-blur px-4 py-2 rounded-card shadow-card text-sm font-medium text-ink">
                      {t('home.card.greeting')}
                    </div>
                  </div>
                </div>

                {/* The two cards show what Ruah DOES, not a caregiver. There is no
                    rating system and no real Sarah Chen; both used to be on this card.
                    max-w keeps the longer Chinese from pushing the card off a phone. */}
                <div className="absolute -top-2 -right-4 max-w-[11rem] bg-surface rounded-card shadow-md p-3 animate-float-slow">
                  <div className="text-xs text-ink-muted mb-1">{t('home.card.working.label')}</div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-brand rounded-full animate-pulse shrink-0" />
                    <div className="text-xs font-medium text-ink">{t('home.card.working.value')}</div>
                  </div>
                </div>

                {/* Wording is bounded by what /trust claims: a government ID checked
                    against a selfie, by hand. Never "background check". */}
                <div className="absolute -bottom-2 -left-4 max-w-[11rem] bg-surface rounded-card shadow-md p-3 animate-float-delay">
                  <div className="text-xs text-ink-muted mb-1">{t('home.card.verified.label')}</div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-positive rounded-full shrink-0" />
                    <div className="text-xs font-medium text-positive">{t('home.card.verified.value')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-6 bg-surface">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-ink mb-3">{t('home.how.title')}</h2>
          <p className="text-ink-faint mb-14">{t('home.how.sub')}</p>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map(item => (
              <div key={item.step} className="flex flex-col items-center">
                <div className="text-xs font-bold text-brand mb-4 tracking-widest">{item.step}</div>
                <div className="w-12 h-12 rounded-full bg-brand-soft text-brand-strong flex items-center justify-center mb-4">
                  <Icon path={item.icon} className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-ink mb-2">{t(item.title)}</h3>
                <p className="text-ink-faint text-sm leading-relaxed">{t(item.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST — the honest line leads the section instead of trailing it in
          grey 14px, and the closing call to action now lives in the same
          section rather than costing a screen of its own. */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-ink mb-3">{t('home.trust.title')}</h2>
            <p className="text-ink-muted max-w-xl mx-auto leading-relaxed">{t('home.trust.sub')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {trust.map(item => (
              <div key={item.title} className="bg-surface rounded-card p-6 shadow-card">
                <div className="w-10 h-10 rounded-full bg-brand-soft text-brand-strong flex items-center justify-center mb-4">
                  <Icon path={item.icon} className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-ink mb-2">{t(item.title)}</h3>
                <p className="text-ink-faint text-sm leading-relaxed">{t(item.desc)}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-8 text-sm text-ink-muted">
            <Link href="/trust" className="text-brand-strong font-medium hover:underline">
              {t('home.trust.noChecksLink')}
            </Link>
          </p>

          <div className="mt-16 bg-gradient-to-br from-brand-soft to-warm rounded-3xl p-10 sm:p-12 text-center">
            <div className="flex justify-center mb-6" style={{ filter: 'drop-shadow(0 0 16px rgba(127,179,255,0.5))' }}>
              <img src="/ruah-logo.png" alt="Ruah" className="w-20 h-20" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-ink mb-4">
              {t('home.cta.title')}
            </h2>
            <p className="text-ink-muted mb-8">{t('home.cta.sub')}</p>
            <button onClick={() => router.push('/onboarding/family')}
              className="bg-brand-gradient shadow-brand text-white px-10 py-4 rounded-card font-semibold text-lg transition hover:-translate-y-px">
              {t('home.cta.button')}
            </button>
            <p className="text-ink-faint text-sm mt-4">{t('home.cta.caregiverPrompt')}{' '}
              <button onClick={() => router.push('/onboarding/caregiver')} className="text-brand hover:underline">
                {t('home.cta.caregiverLink')}
              </button>
            </p>
          </div>
        </div>
      </section>

      {/* Site footer (privacy / terms / trust) comes from the root layout. */}
    </div>
  )
}
