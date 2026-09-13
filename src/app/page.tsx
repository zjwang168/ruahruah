'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import LangToggle from '@/components/LangToggle'
import { useT } from '@/lib/i18n/provider'

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
  // side by side; the emoji and the colours are not translatable and stay here.
  const steps = [
    { step: '01', emoji: '💬', title: 'home.how.1.title', desc: 'home.how.1.desc' },
    { step: '02', emoji: '🤝', title: 'home.how.2.title', desc: 'home.how.2.desc' },
    { step: '03', emoji: '✨', title: 'home.how.3.title', desc: 'home.how.3.desc' },
  ] as const

  const services = [
    { emoji: '👶', label: 'home.services.fulltime.label', desc: 'home.services.fulltime.desc', color: 'bg-blue-50' },
    { emoji: '🎒', label: 'home.services.afterschool.label', desc: 'home.services.afterschool.desc', color: 'bg-orange-50' },
    { emoji: '🌙', label: 'home.services.evenings.label', desc: 'home.services.evenings.desc', color: 'bg-green-50' },
    { emoji: '🍼', label: 'home.services.newborn.label', desc: 'home.services.newborn.desc', color: 'bg-purple-50' },
    { emoji: '🗣', label: 'home.services.bilingual.label', desc: 'home.services.bilingual.desc', color: 'bg-yellow-50' },
    { emoji: '☀️', label: 'home.services.breaks.label', desc: 'home.services.breaks.desc', color: 'bg-pink-50' },
  ] as const

  const trust = [
    { emoji: '🪪', title: 'home.trust.identity.title', desc: 'home.trust.identity.desc' },
    { emoji: '🔒', title: 'home.trust.docs.title', desc: 'home.trust.docs.desc' },
    { emoji: '💬', title: 'home.trust.record.title', desc: 'home.trust.record.desc' },
  ] as const

  return (
    <div className="min-h-screen bg-[#FAFCFF] font-sans">

      {/* NAV */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur shadow-sm' : 'bg-transparent'}`}>
        {/* Four items on a 360px phone is the tightest row on the site, and the
            language switch — the one control a Chinese visitor arriving from a
            shared link needs — was the thing being crushed. Everything shrinks a
            step below sm and nothing is allowed to shrink into its neighbour. */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8 sm:w-9 sm:h-9" />
            <span className="text-lg sm:text-xl font-bold text-[#7FB3FF]">Ruah！</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <LangToggle />
            <button onClick={() => router.push('/login')} className="text-sm text-gray-500 hover:text-gray-800 transition whitespace-nowrap">
              {t('nav.signin')}
            </button>
            <button onClick={() => router.push('/onboarding/family')} className="btn-primary text-white px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full text-sm font-medium whitespace-nowrap">
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
              <div className="inline-flex items-center gap-2 bg-[#EAF4FF] text-[#4A90D9] text-xs font-medium px-3 py-1.5 rounded-full mb-6">
                {t('home.hero.badge')}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
                {t('home.hero.line1')}<br />
                {t('home.hero.line2')}<br />
                <span className="text-[#7FB3FF]">{t('home.hero.line3')}</span>
              </h1>
              <p className="text-gray-500 text-lg mb-8 leading-relaxed">
                {t('home.hero.sub')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => router.push('/onboarding/family')}
                  className="btn-primary text-white px-8 py-4 rounded-2xl font-semibold text-lg">
                  {t('home.hero.ctaFamily')}
                </button>
                <button onClick={() => router.push('/onboarding/caregiver')}
                  className="border-2 border-gray-200 text-gray-600 px-8 py-4 rounded-2xl font-semibold text-lg hover:border-[#7FB3FF] hover:text-[#7FB3FF] transition">
                  {t('home.hero.ctaCaregiver')}
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-4">{t('home.hero.assurances')}</p>
              <p className="text-gray-400 text-sm mt-3">
                {t('home.hero.humanPrompt')}{' '}
                <Link href="/concierge" className="text-[#4A90D9] hover:underline">
                  {t('home.hero.humanLink')}
                </Link>
              </p>
            </div>

            {/* Hero Visual */}
            <div className="relative flex items-center justify-center">
              <div className="relative w-80 h-80">
                <div className="absolute inset-0 bg-gradient-to-br from-[#EAF4FF] to-[#FFF6F2] rounded-full opacity-60" />
                <div className="absolute inset-0 flex items-center justify-center animate-float">
                  <div className="text-center">
                    <div className="mb-4" style={{ filter: 'drop-shadow(0 8px 32px rgba(127,179,255,0.45))' }}>
                      <img src="/ruah-logo.png" alt="Ruah" className="w-36 h-36 mx-auto" />
                    </div>
                    <div className="bg-white/80 backdrop-blur px-4 py-2 rounded-2xl shadow-sm text-sm font-medium text-gray-700">
                      {t('home.card.greeting')}
                    </div>
                  </div>
                </div>

                <div className="absolute -top-2 -right-4 bg-white rounded-2xl shadow-md p-3 animate-float-slow">
                  <div className="text-xs text-gray-500">{t('home.card.matchFound')}</div>
                  <div className="text-sm font-semibold text-gray-800">{t('home.card.matchName')}</div>
                  <div className="text-xs text-[#7FB3FF]">{t('home.card.matchMeta')}</div>
                </div>

                <div className="absolute -bottom-2 -left-4 bg-white rounded-2xl shadow-md p-3 animate-float-delay">
                  <div className="text-xs text-gray-500 mb-1">{t('home.card.checkLabel')}</div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <div className="text-xs font-medium text-green-600">{t('home.card.checkValue')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">{t('home.how.title')}</h2>
          <p className="text-gray-400 mb-14">{t('home.how.sub')}</p>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map(item => (
              <div key={item.step}>
                <div className="text-xs font-bold text-[#7FB3FF] mb-4 tracking-widest">{item.step}</div>
                <div className="text-4xl mb-4">{item.emoji}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{t(item.title)}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{t(item.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="py-20 px-6 bg-[#FAFCFF]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">{t('home.services.title')}</h2>
            <p className="text-gray-400">{t('home.services.sub')}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {services.map(s => (
              <button key={s.label} onClick={() => router.push('/onboarding/family')}
                className={`${s.color} p-6 rounded-2xl text-left hover:scale-[1.02] transition-transform`}>
                <div className="text-3xl mb-3">{s.emoji}</div>
                <div className="font-semibold text-gray-900 text-sm">{t(s.label)}</div>
                <div className="text-xs text-gray-400 mt-1">{t(s.desc)}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">{t('home.trust.title')}</h2>
            <p className="text-gray-400">{t('home.trust.sub')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {trust.map(item => (
              <div key={item.title} className="bg-[#FAFCFF] rounded-2xl p-6">
                <div className="text-3xl mb-4">{item.emoji}</div>
                <h3 className="font-bold text-gray-900 mb-2">{t(item.title)}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{t(item.desc)}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-8 text-sm text-gray-500">
            {t('home.trust.noChecks')}{' '}
            <Link href="/trust" className="text-[#4A90D9] font-medium hover:underline">
              {t('home.trust.noChecksLink')}
            </Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-gradient-to-br from-[#EAF4FF] to-[#FFF6F2] rounded-3xl p-12">
            <div className="flex justify-center mb-6" style={{ filter: 'drop-shadow(0 0 16px rgba(127,179,255,0.5))' }}>
              <img src="/ruah-logo.png" alt="Ruah" className="w-20 h-20" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {t('home.cta.title')}
            </h2>
            <p className="text-gray-500 mb-8">{t('home.cta.sub')}</p>
            <button onClick={() => router.push('/onboarding/family')}
              className="btn-primary text-white px-10 py-4 rounded-2xl font-semibold text-lg">
              {t('home.cta.button')}
            </button>
            <p className="text-gray-400 text-sm mt-4">{t('home.cta.caregiverPrompt')}{' '}
              <span onClick={() => router.push('/onboarding/caregiver')} className="text-[#7FB3FF] cursor-pointer hover:underline">
                {t('home.cta.caregiverLink')}
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* Site footer (privacy / terms / trust) comes from the root layout. */}

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes float-delay {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
        .animate-float-delay { animation: float-delay 3.5s ease-in-out infinite 0.5s; }
        .btn-primary {
          background: linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%);
          box-shadow: 0 8px 32px rgba(127, 179, 255, 0.35);
          transition: all 0.3s ease;
        }
        .btn-primary:hover {
          box-shadow: 0 12px 40px rgba(127, 179, 255, 0.55);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  )
}
