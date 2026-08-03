'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { SELECTABLE_SERVICES, SERVICE_FOCUS_NOTE } from '@/lib/services'

const SERVICES = SELECTABLE_SERVICES

type Answers = Record<string, any>

export default function CaregiverOnboarding() {
  const [step, setStep] = useState('services')
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [answers, setAnswers] = useState<Answers>({})
  const [zipcode, setZipcode] = useState('')
  const [zipcodeInfo, setZipcodeInfo] = useState<{ city: string; state: string } | null>(null)
  const [zipcodeLoading, setZipcodeLoading] = useState(false)
  const [zipcodeError, setZipcodeError] = useState('')
  const router = useRouter()

  const save = (key: string, value: any) => setAnswers(prev => ({ ...prev, [key]: value }))

  const toggleService = (id: string) => {
    setSelectedServices(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const STEPS = ['services', 'experience', 'languages', 'availability', 'living', 'rate', 'zipcode']

  const next = (current: string) => {
    const idx = STEPS.indexOf(current)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  const back = (current: string) => {
    const idx = STEPS.indexOf(current)
    if (idx > 0) setStep(STEPS[idx - 1])
    else router.push('/')
  }

  const lookupZipcode = async (zip: string) => {
    if (zip.length !== 5) { setZipcodeInfo(null); setZipcodeError(''); return }
    setZipcodeLoading(true)
    setZipcodeError('')
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
      if (!res.ok) { setZipcodeError('Invalid ZIP code'); setZipcodeInfo(null) }
      else {
        const data = await res.json()
        const place = data.places?.[0]
        if (place) setZipcodeInfo({ city: place['place name'], state: place['state abbreviation'] })
      }
    } catch { setZipcodeError('Could not verify') }
    finally { setZipcodeLoading(false) }
  }

  const handleZipcodeChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 5)
    setZipcode(cleaned)
    lookupZipcode(cleaned)
  }

  const goToRegister = (finalAnswers: Answers) => {
    router.push(`/onboarding/register?role=caregiver&answers=${encodeURIComponent(JSON.stringify({
      ...finalAnswers,
      services: selectedServices,
      zipcode,
      city: zipcodeInfo?.city,
      state: zipcodeInfo?.state,
    }))}`)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">

        {/* Step: 选服务 */}
        {step === 'services' && (
          <div>
            <button onClick={() => router.push('/')} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">What kind of care do you provide?</h1>
            <p className="text-gray-400 text-sm mb-8">{SERVICE_FOCUS_NOTE}</p>
            <div className={`grid gap-3 mb-8 ${SERVICES.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {SERVICES.map(s => (
                <button key={s.id} onClick={() => toggleService(s.id)}
                  className={`p-4 rounded-2xl border-2 text-left transition ${
                    selectedServices.includes(s.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="text-2xl mb-1">{s.emoji}</div>
                  <div className="font-medium text-sm text-gray-900">{s.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={() => next('services')} disabled={selectedServices.length === 0}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40 hover:bg-blue-700 transition">
              Continue →
            </button>
          </div>
        )}

        {/* Step: 经验 */}
        {step === 'experience' && (
          <div>
            <button onClick={() => back('experience')} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900 mb-8">How many years of experience do you have?</h1>
            <div className="space-y-3">
              {[
                { id: '0', label: '🌱 Just starting out', desc: 'Less than 1 year' },
                { id: '1', label: '⭐ 1–2 years' },
                { id: '3', label: '⭐⭐ 3–5 years' },
                { id: '5', label: '⭐⭐⭐ 5–10 years' },
                { id: '10', label: '🏆 10+ years' },
              ].map(opt => (
                <button key={opt.id} onClick={() => { save('experience', opt.id); next('experience') }}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition ${
                    answers.experience === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="font-medium text-gray-900">{opt.label}</div>
                  {opt.desc && <div className="text-sm text-gray-400 mt-0.5">{opt.desc}</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: 语言 */}
        {step === 'languages' && (
          <div>
            <button onClick={() => back('languages')} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">What languages do you speak?</h1>
            <p className="text-gray-400 text-sm mb-8">Select all that apply</p>
            <div className="space-y-3 mb-8">
              {['English', 'Mandarin', 'Cantonese', 'Spanish', 'French', 'Other'].map(lang => (
                <button key={lang}
                  onClick={() => {
                    const curr = answers.languages || []
                    save('languages', curr.includes(lang) ? curr.filter((l: string) => l !== lang) : [...curr, lang])
                  }}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition ${
                    (answers.languages || []).includes(lang) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="font-medium text-gray-900">{lang}</div>
                </button>
              ))}
            </div>
            <button onClick={() => next('languages')} disabled={!answers.languages?.length}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40">
              Continue →
            </button>
          </div>
        )}

        {/* Step: 可用时间 */}
        {step === 'availability' && (
          <div>
            <button onClick={() => back('availability')} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900 mb-8">When are you available?</h1>
            <div className="space-y-3">
              {[
                { id: 'fulltime', label: '🗓 Full-time', desc: 'Mon–Fri, 40hrs/week' },
                { id: 'parttime', label: '⏰ Part-time', desc: 'Flexible hours' },
                { id: 'weekends', label: '🌅 Weekends only' },
                { id: 'evenings', label: '🌙 Evenings & overnight' },
                { id: 'flexible', label: '😊 Very flexible' },
              ].map(opt => (
                <button key={opt.id} onClick={() => { save('availability', opt.id); next('availability') }}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition ${
                    answers.availability === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="font-medium text-gray-900">{opt.label}</div>
                  {opt.desc && <div className="text-sm text-gray-400 mt-0.5">{opt.desc}</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Live-in */}
        {step === 'living' && (
          <div>
            <button onClick={() => back('living')} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900 mb-8">Are you open to live-in positions?</h1>
            <div className="space-y-3">
              {[
                { id: 'yes', label: '🏠 Yes, open to live-in', desc: 'I can live with the family' },
                { id: 'no', label: '🚗 No, live-out only', desc: 'I commute to work' },
                { id: 'open', label: '🤔 Open to discuss', desc: 'Depends on the family' },
              ].map(opt => (
                <button key={opt.id} onClick={() => { save('living', opt.id); next('living') }}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition ${
                    answers.living === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="font-medium text-gray-900">{opt.label}</div>
                  {opt.desc && <div className="text-sm text-gray-400 mt-0.5">{opt.desc}</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: 价格 */}
        {step === 'rate' && (
          <div>
            <button onClick={() => back('rate')} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">What's your hourly rate?</h1>
            <p className="text-gray-400 text-sm mb-8">per hour · you can update this anytime</p>
            <div className="space-y-3">
              {[
                { id: '$15–25', label: '$15–25/hr', desc: 'Entry level' },
                { id: '$25–35', label: '$25–35/hr', desc: 'Experienced' },
                { id: '$35–50', label: '$35–50/hr', desc: 'Highly experienced' },
                { id: '$50–80', label: '$50–80/hr', desc: 'Specialized skills' },
                { id: '$80+', label: '$80+/hr', desc: 'Premium / medical background' },
              ].map(opt => (
                <button key={opt.id} onClick={() => { save('rate', opt.id); next('rate') }}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition ${
                    answers.rate === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="font-medium text-gray-900">{opt.label}</div>
                  <div className="text-sm text-gray-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Zipcode — 最后一步 */}
        {step === 'zipcode' && (
          <div>
            <button onClick={() => back('zipcode')} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
            <div className="text-center mb-8">
              <div className="text-4xl mb-3">📍</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Where are you located?</h1>
              <p className="text-gray-400 text-sm">Families nearby will be able to find you</p>
            </div>
            <div className="relative mb-3">
              <input
                type="text"
                inputMode="numeric"
                value={zipcode}
                onChange={e => handleZipcodeChange(e.target.value)}
                className={`w-full border-2 rounded-2xl px-4 py-4 text-lg text-center font-medium focus:outline-none tracking-widest ${
                  zipcodeError ? 'border-red-300' : zipcodeInfo ? 'border-green-400' : 'border-gray-200 focus:border-blue-400'
                }`}
                placeholder="ZIP Code"
                maxLength={5}
              />
              {zipcodeLoading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {zipcodeInfo && (
              <div className="flex items-center justify-center gap-2 mb-6 text-green-600">
                <span className="text-lg">✓</span>
                <span className="font-semibold">{zipcodeInfo.city}, {zipcodeInfo.state}</span>
              </div>
            )}
            {zipcodeError && (
              <p className="text-center text-red-400 text-sm mb-6">{zipcodeError}</p>
            )}
            {!zipcodeInfo && !zipcodeError && zipcode.length < 5 && (
              <p className="text-center text-gray-400 text-sm mb-6">Enter your 5-digit ZIP code</p>
            )}

            <button
              onClick={() => goToRegister(answers)}
              disabled={!zipcodeInfo || zipcodeLoading}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40 hover:bg-blue-700 transition"
            >
              Continue →
            </button>

          </div>
        )}

      </div>
    </div>
  )
}