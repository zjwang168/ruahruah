'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { SELECTABLE_SERVICES, SERVICE_FOCUS_NOTE } from '@/lib/services'

const SERVICE_TYPES = SELECTABLE_SERVICES.map(s => ({ id: s.id, label: `${s.emoji} ${s.label}` }))

export default function CaregiverOnboarding() {
  const [step, setStep] = useState(1)
  const [services, setServices] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [experience, setExperience] = useState(0)
  const [rateMin, setRateMin] = useState('')
  const [rateMax, setRateMax] = useState('')
  const [bio, setBio] = useState('')
  const [city, setCity] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const toggle = (arr: string[], setArr: Function, val: string) => {
    setArr((prev: string[]) => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }

  const handleFinish = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('caregiver_profiles').update({
      services,
      languages,
      years_experience: experience,
      hourly_rate_min: Number(rateMin),
      hourly_rate_max: Number(rateMax),
      bio,
    }).eq('user_id', user.id)

    await supabase.from('users').update({ city }).eq('id', user.id)

    router.push('/caregiver/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-sm w-full max-w-lg">

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1,2,3,4].map(i => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Step 1: 服务类型 */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">What kind of care do you provide?</h2>
            <p className="text-gray-500 text-sm mb-6">{SERVICE_FOCUS_NOTE}</p>
            <div className={`grid gap-3 mb-8 ${SERVICE_TYPES.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {SERVICE_TYPES.map(s => (
                <button
                  key={s.id}
                  onClick={() => toggle(services, setServices, s.id)}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    services.includes(s.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="font-medium text-sm">{s.label}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={services.length === 0}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 2: 语言和经验 */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Your background</h2>
            <p className="text-gray-500 text-sm mb-6">Help families get to know you</p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Languages you speak</label>
              <div className="flex flex-wrap gap-2">
                {['English', 'Mandarin', 'Cantonese', 'Spanish', 'Other'].map(lang => (
                  <button
                    key={lang}
                    onClick={() => toggle(languages, setLanguages, lang)}
                    className={`px-4 py-2 rounded-full border-2 text-sm transition ${
                      languages.includes(lang) ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">Years of experience</label>
              <div className="flex gap-3">
                {[0,1,2,3,5,10].map(n => (
                  <button
                    key={n}
                    onClick={() => setExperience(n)}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition ${
                      experience === n ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200'
                    }`}
                  >
                    {n === 10 ? '10+' : n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-200 py-3 rounded-lg text-sm">← Back</button>
              <button onClick={() => setStep(3)} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium">Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3: 价格和城市 */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Rate & location</h2>
            <p className="text-gray-500 text-sm mb-6">You can always update this later</p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Hourly rate range (USD)</label>
              <div className="flex gap-3 items-center">
                <input
                  type="number"
                  value={rateMin}
                  onChange={e => setRateMin(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Min $"
                />
                <span className="text-gray-400">—</span>
                <input
                  type="number"
                  value={rateMax}
                  onChange={e => setRateMax(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Max $"
                />
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. San Francisco, CA"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 border border-gray-200 py-3 rounded-lg text-sm">← Back</button>
              <button onClick={() => setStep(4)} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium">Continue →</button>
            </div>
          </div>
        )}

        {/* Step 4: Bio */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Introduce yourself</h2>
            <p className="text-gray-500 text-sm mb-6">Write a short bio to help families get to know you</p>

            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={5}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-8"
              placeholder="Hi! I'm a experienced caregiver with a passion for..."
            />

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 border border-gray-200 py-3 rounded-lg text-sm">← Back</button>
              <button
                onClick={handleFinish}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Finish →'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}