'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

import { SELECTABLE_SERVICES } from '@/lib/services'

const SERVICE_OPTIONS = SELECTABLE_SERVICES.map(s => ({ value: s.id, label: s.label }))

const LANGUAGE_OPTIONS = ['English', 'Mandarin', 'Spanish', 'French']

const EXPERIENCE_LABELS: Record<string, string> = {
  '0': '< 1 yr', '1': '1–2 yrs', '3': '3–5 yrs', '5': '5–10 yrs', '10': '10+ yrs',
}

function computeMatch(caregiver: any, familyRequest: any, matchedCaregiverIds: Set<string>): { score: number; tags: string[] } {
  if (!familyRequest) return { score: 0, tags: [] }
  const tags: string[] = []
  let score = 0

  if (matchedCaregiverIds.has(caregiver.users?.id)) {
    tags.push('Matched ✓')
    score += 20
  }

  if (familyRequest.service_type && caregiver.services?.includes(familyRequest.service_type)) {
    tags.push('Service match')
    score += 40
  }

  const reqLangs: string[] = familyRequest.languages || []
  const cgLangs: string[] = caregiver.languages || []
  const sharedLangs = reqLangs.filter((l: string) => cgLangs.includes(l))
  if (sharedLangs.length > 0) {
    sharedLangs.forEach((l: string) => tags.push(l))
    score += 30
  }

  if (familyRequest.pay_max && caregiver.hourly_rate_min) {
    if (caregiver.hourly_rate_min <= familyRequest.pay_max) {
      tags.push('In budget')
      score += 20
    }
  }

  if (caregiver.is_verified) {
    tags.push('Verified')
    score += 10
  }

  return { score: Math.min(score, 100), tags }
}

export default function SearchPage() {
  const [user, setUser] = useState<any>(null)
  const [caregivers, setCaregivers] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [familyRequest, setFamilyRequest] = useState<any>(null)
  const [matchedCaregiverIds, setMatchedCaregiverIds] = useState<Set<string>>(new Set())

  const [serviceFilter, setServiceFilter] = useState('')
  const [languageFilter, setLanguageFilter] = useState('')
  const [zipcodeFilter, setZipcodeFilter] = useState('')
  const [zipcodeInfo, setZipcodeInfo] = useState<{ city: string; state: string } | null>(null)
  const [zipcodeLoading, setZipcodeLoading] = useState(false)
  const [maxRateFilter, setMaxRateFilter] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: userData } = await supabase.from('users').select('zipcode, city, state, role').eq('id', authUser.id).single()
        setUser(userData)
        if (userData?.zipcode) {
          setZipcodeFilter(userData.zipcode)
          if (userData.city && userData.state) {
            setZipcodeInfo({ city: userData.city, state: userData.state })
          }
        }

        const { data: familyData } = await supabase
          .from('family_profiles')
          .select('id, onboarding_answers')
          .eq('user_id', authUser.id)
          .single()

        if (familyData?.id) {
          // Try open request first, fall back to onboarding answers
          const { data: reqData } = await supabase
            .from('service_requests')
            .select('service_type, languages, pay_min, pay_max')
            .eq('family_id', familyData.id)
            .eq('status', 'open')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (reqData) {
            setFamilyRequest(reqData)
            if (reqData.service_type) setServiceFilter(reqData.service_type)
          } else if (familyData.onboarding_answers) {
            const answers = familyData.onboarding_answers
            const onboardingRequest = {
              service_type: answers.services?.[0] || '',
              languages: answers.language_preference || answers.languages || [],
              pay_min: null,
              pay_max: answers.childcare_budget
                ? parseInt(answers.childcare_budget.replace(/\D/g, '').split('–')[1] || '0')
                : null,
            }
            setFamilyRequest(onboardingRequest)
            if (onboardingRequest.service_type) setServiceFilter(onboardingRequest.service_type)
          }

          // Load matched caregiver IDs
          const { data: matchData } = await supabase
            .from('matches')
            .select(`caregiver_profiles(user_id), service_requests!inner(family_id)`)
            .eq('service_requests.family_id', familyData.id)
          if (matchData) {
            const ids = new Set(matchData.map((m: any) => m.caregiver_profiles?.user_id).filter(Boolean))
            setMatchedCaregiverIds(ids)
          }
        }
      }

      const { data } = await supabase
        .from('caregiver_profiles')
        .select(`
          id, services, languages, hourly_rate_min, hourly_rate_max,
          years_experience, bio, is_verified, onboarding_answers,
          users ( id, full_name, avatar_url, zipcode, city, state )
        `)
        .eq('users.is_banned', false)
        .eq('users.is_shadow_banned', false)
        .not('bio', 'is', null)

      setCaregivers(data || [])
      setFiltered(data || [])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    let result = [...caregivers]

    if (serviceFilter) result = result.filter(c => c.services?.includes(serviceFilter))
    if (languageFilter) result = result.filter(c => c.languages?.includes(languageFilter))
    if (zipcodeInfo) {
      result = result.filter(c => {
        const u = c.users
        if (!u?.city || !u?.state) return true
        return u.state === zipcodeInfo.state
      })
    }
    if (maxRateFilter) result = result.filter(c => !c.hourly_rate_min || c.hourly_rate_min <= parseInt(maxRateFilter))
    if (verifiedOnly) result = result.filter(c => c.is_verified)

    result = result.map(c => ({
      ...c,
      _match: computeMatch(c, familyRequest, matchedCaregiverIds)
    }))

    result.sort((a, b) => {
      const aMatched = matchedCaregiverIds.has(a.users?.id) ? 1 : 0
      const bMatched = matchedCaregiverIds.has(b.users?.id) ? 1 : 0
      if (aMatched !== bMatched) return bMatched - aMatched
      return b._match.score - a._match.score
    })

    setFiltered(result)
  }, [serviceFilter, languageFilter, zipcodeInfo, maxRateFilter, verifiedOnly, caregivers, familyRequest, matchedCaregiverIds])

  const lookupZipcode = async (zip: string) => {
    if (zip.length !== 5) { setZipcodeInfo(null); return }
    setZipcodeLoading(true)
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
      if (res.ok) {
        const data = await res.json()
        const place = data.places?.[0]
        if (place) setZipcodeInfo({ city: place['place name'], state: place['state abbreviation'] })
      } else { setZipcodeInfo(null) }
    } catch { setZipcodeInfo(null) }
    finally { setZipcodeLoading(false) }
  }

  const handleZipcodeChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 5)
    setZipcodeFilter(cleaned)
    lookupZipcode(cleaned)
  }

  const clearFilters = () => {
    setServiceFilter('')
    setLanguageFilter('')
    setMaxRateFilter('')
    setVerifiedOnly(false)
    if (user?.zipcode) {
      setZipcodeFilter(user.zipcode)
      if (user.city && user.state) setZipcodeInfo({ city: user.city, state: user.state })
    }
  }

  const activeFilterCount = [serviceFilter, languageFilter, maxRateFilter, verifiedOnly].filter(Boolean).length

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex-1">
          <div className="font-semibold text-gray-900 text-sm">Browse Caregivers</div>
          <div className="text-xs text-gray-400">{filtered.length} available</div>
        </div>
        <button onClick={() => setShowFilters(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition ${
            showFilters || activeFilterCount > 0
              ? 'bg-[#7FB3FF] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-white text-[#7FB3FF] text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </header>

      {showFilters && (
        <div className="bg-white border-b border-gray-100 px-6 py-5">
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-2">📍 Location (ZIP code)</label>
            <div className="relative">
              <input type="text" inputMode="numeric" value={zipcodeFilter}
                onChange={e => handleZipcodeChange(e.target.value)}
                placeholder="Enter ZIP code" maxLength={5}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">
                {zipcodeLoading && <span className="text-gray-400">...</span>}
                {!zipcodeLoading && zipcodeInfo && (
                  <span className="text-green-500 font-medium">{zipcodeInfo.city}, {zipcodeInfo.state}</span>
                )}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-2">Service type</label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setServiceFilter(serviceFilter === opt.value ? '' : opt.value)}
                  className={`px-3 py-1.5 rounded-full border text-xs transition ${
                    serviceFilter === opt.value
                      ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9] font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-2">Language</label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map(lang => (
                <button key={lang} onClick={() => setLanguageFilter(languageFilter === lang ? '' : lang)}
                  className={`px-3 py-1.5 rounded-full border text-xs transition ${
                    languageFilter === lang
                      ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9] font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-2">Max rate ($/hr)</label>
            <div className="flex gap-2">
              {['20', '30', '40', '50', '60'].map(rate => (
                <button key={rate} onClick={() => setMaxRateFilter(maxRateFilter === rate ? '' : rate)}
                  className={`px-3 py-1.5 rounded-full border text-xs transition ${
                    maxRateFilter === rate
                      ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9] font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  ≤${rate}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <label className="text-xs font-semibold text-gray-700">Verified only</label>
            <div onClick={() => setVerifiedOnly(p => !p)}
              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${verifiedOnly ? 'bg-[#7FB3FF]' : 'bg-gray-200'}`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow ${verifiedOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600 underline">
              Clear all filters
            </button>
          )}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-sm">No caregivers found.</p>
            <button onClick={clearFilters} className="mt-2 text-xs text-[#7FB3FF] hover:underline">Clear filters</button>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(c => {
              const u = c.users
              const answers = c.onboarding_answers || {}
              const match = c._match || { score: 0, tags: [] }
              const isMatched = matchedCaregiverIds.has(u?.id)

              return (
                <div key={c.id}
                  onClick={() => router.push(`/caregiver/${u?.id}`)}
                  className={`bg-white rounded-2xl border p-5 hover:shadow-sm transition cursor-pointer ${
                    isMatched ? 'border-green-200 bg-green-50/20' : 'border-gray-100 hover:border-[#7FB3FF]/40'
                  }`}>
                  <div className="flex items-start gap-3">
                    {u?.avatar_url
                      ? <img src={u.avatar_url} className="w-14 h-14 rounded-full object-cover flex-shrink-0" alt="" />
                      : <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                          {u?.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                    }

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{u?.full_name || 'Caregiver'}</span>
                          {c.is_verified && (
                            <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">✓ Verified</span>
                          )}
                          {isMatched && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">🎉 Matched</span>
                          )}
                        </div>
                        {familyRequest && match.score > 0 && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                            match.score >= 80 ? 'bg-green-100 text-green-700'
                            : match.score >= 50 ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-500'
                          }`}>
                            {match.score}% match
                          </span>
                        )}
                      </div>

                      {u?.city && u?.state && (
                        <div className="text-xs text-gray-400 mt-0.5">📍 {u.city}, {u.state}</div>
                      )}

                      {familyRequest && match.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {match.tags
                            .filter((t: string) => t !== 'Matched ✓' && t !== 'Service match')
                            .map((tag: string) => (
                              <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${
                                tag === 'In budget' ? 'bg-purple-50 text-purple-600'
                                : tag === 'Verified' ? 'bg-green-50 text-green-600'
                                : 'bg-blue-50 text-blue-600'
                              }`}>{tag}</span>
                            ))}
                        </div>
                      )}

                      {!familyRequest && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {c.languages?.slice(0, 3).map((lang: string) => (
                            <span key={lang} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{lang}</span>
                          ))}
                          {c.services?.slice(0, 2).map((svc: string) => (
                            <span key={svc} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{svc}</span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        {c.years_experience != null && (
                          <span>⭐ {EXPERIENCE_LABELS[String(c.years_experience)] || `${c.years_experience} yrs`}</span>
                        )}
                        {c.hourly_rate_min && (
                          <span>💰 ${c.hourly_rate_min}{c.hourly_rate_max ? `–$${c.hourly_rate_max}` : '+'}/hr</span>
                        )}
                        {answers.availability && (
                          <span>🕐 {answers.availability}</span>
                        )}
                      </div>

                      {c.bio && (
                        <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">{c.bio}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}