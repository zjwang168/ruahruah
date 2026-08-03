'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { SELECTABLE_SERVICES, SERVICE_FOCUS_NOTE } from '@/lib/services'

const SERVICE_TYPES = SELECTABLE_SERVICES.map(s => ({
  id: s.id,
  label: `${s.emoji} ${s.label}`,
  desc: s.desc,
}))

export default function FamilyOnboarding() {
  const [step, setStep] = useState(1)
  const [services, setServices] = useState<string[]>([])
  const [numChildren, setNumChildren] = useState(0)
  const [languages, setLanguages] = useState<string[]>([])
  const [city, setCity] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const toggleService = (id: string) => {
    setServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const toggleLanguage = (lang: string) => {
    setLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang])
  }

  const handleFinish = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('family_profiles').update({
      num_children: numChildren,
      languages,
    }).eq('user_id', user.id)

    await supabase.from('users').update({ city }).eq('id', user.id)

    router.push('/family/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-sm w-full max-w-lg">
        
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1,2,3].map(i => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Step 1: 选服务 */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">What kind of care do you need?</h2>
            <p className="text-gray-500 text-sm mb-6">{SERVICE_FOCUS_NOTE}</p>
            <div className={`grid gap-3 mb-8 ${SERVICE_TYPES.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {SERVICE_TYPES.map(s => (
                <button
                  key={s.id}
                  onClick={() => toggleService(s.id)}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    services.includes(s.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="font-medium text-sm">{s.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.desc}</div>
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

        {/* Step 2: 家庭信息 */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Tell us about your family</h2>
            <p className="text-gray-500 text-sm mb-6">Help us find the best match</p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Number of children</label>
              <div className="flex gap-3">
                {[0,1,2,3,'4+'].map(n => (
                  <button
                    key={n}
                    onClick={() => setNumChildren(Number(n))}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition ${
                      numChildren === Number(n) ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Languages spoken at home</label>
              <div className="flex flex-wrap gap-2">
                {['English', 'Mandarin', 'Cantonese', 'Spanish', 'Other'].map(lang => (
                  <button
                    key={lang}
                    onClick={() => toggleLanguage(lang)}
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
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-200 py-3 rounded-lg text-sm">← Back</button>
              <button onClick={() => setStep(3)} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium">Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3: 完成 */}
        {step === 3 && (
          <div className="text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">You're all set!</h2>
            <p className="text-gray-500 text-sm mb-8">We'll help you find the perfect match for your family</p>
            <button
              onClick={handleFinish}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Go to Dashboard →'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}