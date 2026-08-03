'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function Home() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#FAFCFF] font-sans">

      {/* NAV */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/ruah-logo.png" alt="Ruah" className="w-9 h-9" />
            <span className="text-xl font-bold text-[#7FB3FF]">Ruah！</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/login')} className="text-sm text-gray-500 hover:text-gray-800 transition">Sign in</button>
            <button onClick={() => router.push('/onboarding/family')} className="btn-primary text-white px-5 py-2 rounded-full text-sm font-medium">
              Get started
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
                ✨ AI-powered family care
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
                Find trusted care<br />
                for your family —<br />
                <span className="text-[#7FB3FF]">without the stress.</span>
              </h1>
              <p className="text-gray-500 text-lg mb-8 leading-relaxed">
                We match your family with the right caregiver automatically. Nannies, babysitters, after-school and newborn care — childcare that feels right.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => router.push('/onboarding/family')}
                  className="btn-primary text-white px-8 py-4 rounded-2xl font-semibold text-lg">
                  Find a caregiver →
                </button>
                <button onClick={() => router.push('/onboarding/caregiver')}
                  className="border-2 border-gray-200 text-gray-600 px-8 py-4 rounded-2xl font-semibold text-lg hover:border-[#7FB3FF] hover:text-[#7FB3FF] transition">
                  I'm a caregiver
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-4">✓ Free to browse &nbsp; ✓ Verified caregivers &nbsp; ✓ No commitment</p>
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
                      Hi! I'm Ruah! 👋
                    </div>
                  </div>
                </div>

                <div className="absolute -top-2 -right-4 bg-white rounded-2xl shadow-md p-3 animate-float-slow">
                  <div className="text-xs text-gray-500">Match found! 🎉</div>
                  <div className="text-sm font-semibold text-gray-800">Sarah Chen</div>
                  <div className="text-xs text-[#7FB3FF]">⭐ 4.9 · Mandarin speaker</div>
                </div>

                <div className="absolute -bottom-2 -left-4 bg-white rounded-2xl shadow-md p-3 animate-float-delay">
                  <div className="text-xs text-gray-500 mb-1">Background check</div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <div className="text-xs font-medium text-green-600">Verified ✓</div>
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
          <h2 className="text-3xl font-bold text-gray-900 mb-3">How Ruah works</h2>
          <p className="text-gray-400 mb-14">Simple, fast, and stress-free</p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', emoji: '💬', title: 'Tell us your needs', desc: "Answer a few quick questions about your family and what kind of help you're looking for." },
              { step: '02', emoji: '🤝', title: 'We find your match', desc: 'Our AI reviews caregivers based on your schedule, language, budget, and preferences.' },
              { step: '03', emoji: '✨', title: 'Meet & hire', desc: 'Connect with your top matches, chat, and hire — all in one place.' },
            ].map(item => (
              <div key={item.step}>
                <div className="text-xs font-bold text-[#7FB3FF] mb-4 tracking-widest">{item.step}</div>
                <div className="text-4xl mb-4">{item.emoji}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="py-20 px-6 bg-[#FAFCFF]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Childcare, however you need it</h2>
            <p className="text-gray-400">From full-time help to the occasional evening</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { emoji: '👶', label: 'Full-time nanny', desc: 'Weekday care in your home', color: 'bg-blue-50' },
              { emoji: '🎒', label: 'After school', desc: 'Pickup, homework, dinner', color: 'bg-orange-50' },
              { emoji: '🌙', label: 'Evenings & weekends', desc: 'Date nights and one-offs', color: 'bg-green-50' },
              { emoji: '🍼', label: 'Newborn support', desc: 'The first months at home', color: 'bg-purple-50' },
              { emoji: '🗣', label: 'Bilingual care', desc: 'Mandarin, Cantonese, Spanish', color: 'bg-yellow-50' },
              { emoji: '☀️', label: 'School breaks', desc: 'Holidays and summer', color: 'bg-pink-50' },
            ].map(s => (
              <button key={s.label} onClick={() => router.push('/onboarding/family')}
                className={`${s.color} p-6 rounded-2xl text-left hover:scale-[1.02] transition-transform`}>
                <div className="text-3xl mb-3">{s.emoji}</div>
                <div className="font-semibold text-gray-900 text-sm">{s.label}</div>
                <div className="text-xs text-gray-400 mt-1">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">How we handle trust</h2>
            <p className="text-gray-400">What we check, and what we don&rsquo;t. In plain terms.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { emoji: '🪪', title: 'Identity verified', desc: 'Every verified caregiver has had a government ID and a selfie checked by a person on our team.' },
              { emoji: '🔒', title: 'Documents stay private', desc: 'ID photos are stored privately and are never shown to families. Ever.' },
              { emoji: '💬', title: 'Coordination on Ruah', desc: 'Messages and the commitments people make stay on the platform, so there is always a record.' },
            ].map(item => (
              <div key={item.title} className="bg-[#FAFCFF] rounded-2xl p-6">
                <div className="text-3xl mb-4">{item.emoji}</div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-8 text-sm text-gray-500">
            We don&rsquo;t run background checks.{' '}
            <Link href="/trust" className="text-[#4A90D9] font-medium hover:underline">
              Here&rsquo;s what that means, and how to arrange your own →
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
              Ready to find your perfect match?
            </h2>
            <p className="text-gray-500 mb-8">Get started in minutes. No credit card required.</p>
            <button onClick={() => router.push('/onboarding/family')}
              className="btn-primary text-white px-10 py-4 rounded-2xl font-semibold text-lg">
              Find care for my family →
            </button>
            <p className="text-gray-400 text-sm mt-4">Are you a caregiver?{' '}
              <span onClick={() => router.push('/onboarding/caregiver')} className="text-[#7FB3FF] cursor-pointer hover:underline">
                Join here
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