'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { notifyUser } from '@/lib/notifications'

const SERVICE_LABELS: Record<string, string> = {
  childcare: 'Childcare',
  elder_care: 'Senior Care',
  housekeeping: 'Housekeeping',
  chef: 'Personal Chef',
  pet_care: 'Pet Care',
  tutoring: 'Tutoring',
  manual: 'General',
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DISTANCE_OPTIONS = [10, 25, 50, 100]

function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export default function CaregiverRequestsPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  // Tracks request_ids this caregiver is already connected to (via matches table)
  const [myApplications, setMyApplications] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [applyingTo, setApplyingTo] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [hasZip, setHasZip] = useState(false)
  const [requestDistances, setRequestDistances] = useState<Record<string, number>>({})

  const [serviceFilter, setServiceFilter] = useState('')
  const [maxDistance, setMaxDistance] = useState<number | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const { data: userData } = await supabase
        .from('user_self').select('*').single()
      // Own abbreviated name. user_self carries the caller's WHOLE row, but
      // anything this page SENDS to a household has to be what the household
      // is allowed to see — one definition, in public.display_name().
      const { data: meDisplay } = await supabase
        .from('user_display').select('display_name').eq('id', authUser.id).single()
      const { data: caregiverData } = await supabase
        .from('caregiver_profiles').select('*').eq('user_id', authUser.id).single()

      // Pull open requests. The applicant count can no longer come from an
      // embedded `matches ( id )` — RLS shows a caregiver only her OWN match
      // rows, so that embed would report 0 or 1 for every request. The count
      // comes from open_request_stats, a view that aggregates past RLS
      // without exposing whose matches they are.
      const { data: requestsData } = await supabase
        .from('service_requests')
        // No family_profiles embed. 20260913000100 deletes the pre-match
        // arm, so an unmatched caregiver has no row on that table at all —
        // and the embed pulled onboarding_answers, which nothing here reads.
        .select('*')
        .eq('status', 'open')
        .neq('service_type', 'manual')
        .order('created_at', { ascending: false })

      const { data: statsData } = await supabase
        .from('open_request_stats')
        .select('request_id, match_count')
      const matchCounts: Record<string, number> = {}
      statsData?.forEach((s: any) => { matchCounts[s.request_id] = Number(s.match_count) || 0 })

      // Everything this board may know about a household, in one query: an
      // abbreviated name, an avatar, a city. No surname, no zipcode, no
      // intake answers. Keyed by service_requests.family_id = family_public.id.
      const familyIds = [...new Set(
        (requestsData || []).map((r: any) => r.family_id).filter(Boolean)
      )]

      let familyMap: Record<string, any> = {}
      if (familyIds.length > 0) {
        const { data: familyRows } = await supabase
          .from('family_public')
          .select('id, user_id, display_name, avatar_url, city, state')
          .in('id', familyIds)
        familyRows?.forEach((f: any) => { familyMap[f.id] = f })
      }

      const enrichedRequests = (requestsData || []).map((r: any) => ({
        ...r,
        familyUser: familyMap[r.family_id] || null,
        matchCount: matchCounts[r.id] || 0
      }))

      // Which requests is this caregiver already connected to? (any match row, either direction)
      let myApps = new Set<string>()
      if (caregiverData?.id) {
        const { data: matchData } = await supabase
          .from('matches').select('request_id').eq('caregiver_id', caregiverData.id)
        matchData?.forEach((m: any) => myApps.add(m.request_id))
      }

      setUser({ ...userData, display_name: meDisplay?.display_name ?? null })
      setProfile(caregiverData)
      setRequests(enrichedRequests)
      setMyApplications(myApps)

      // Distances are computed by /api/request-distances. Families' zipcodes
      // stay on the server — only mileage comes back. See that route's header.
      if (userData?.zipcode && enrichedRequests.length > 0) {
        setHasZip(true)
        try {
          const res = await fetch('/api/request-distances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestIds: enrichedRequests.map((r: any) => r.id) }),
          })
          if (res.ok) setRequestDistances((await res.json()).distances || {})
        } catch {
          // Leave distances empty; the board renders without the mileage chip.
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  const handleApplyClick = (r: any) => {
    // Gate: require identity verification before applying
    if (!profile?.is_verified) {
      router.push('/caregiver/verify')
      return
    }
    setApplyingTo(r)
  }

  const submitApplication = async () => {
    if (!applyingTo || !profile?.id) return
    setApplying(applyingTo.id)

    const introMessage = message || `Hi! I'm interested in this ${applyingTo.service_type} position. I'd love to connect!`

    // Caregiver applying = caregiver-initiated match (mirror of the AI/family path).
    // caregiver_interested=true, family_interested=null, waiting on the family.
    const { error } = await supabase.from('matches').insert({
      request_id: applyingTo.id,
      caregiver_id: profile.id,
      status: 'pending',
      caregiver_interested: true,
      family_interested: null,
      initiator_message: introMessage,
      initiated_by: 'caregiver',
    })

    if (!error) {
      // family_public.user_id — the messaging keyspace, not the profile id.
      const familyUserId = applyingTo.familyUser?.user_id
      if (familyUserId) {
        // Unified notification type so the family side can wrap it in Ruah narration
        await notifyUser({
          recipientUserId: familyUserId,
          type: 'new_match',
          title: `${user?.display_name} is interested in your request! 🎯`,
          body: introMessage,
          data: {
            caregiverUserId: user?.id,
            caregiverName: user?.display_name,
            requestId: applyingTo.id,
            initiatedBy: 'caregiver',
          }
        })
      }
      setMyApplications(prev => new Set([...prev, applyingTo.id]))
      setApplyingTo(null)
      setMessage('')
    }
    setApplying(null)
  }

  const myServices = profile?.services || []

  const filtered = requests.filter(r => {
    if (serviceFilter && r.service_type !== serviceFilter) return false
    if (maxDistance !== null && requestDistances[r.id] !== undefined) {
      if (requestDistances[r.id] > maxDistance) return false
    }
    return true
  })

  const activeFilterCount = [serviceFilter, maxDistance !== null].filter(Boolean).length

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push('/caregiver/dashboard')}
          className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex-1">
          <div className="font-semibold text-gray-900 text-sm">Browse Requests</div>
          <div className="text-xs text-gray-400">{filtered.length} open positions</div>
        </div>
        <button onClick={() => setShowFilters(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition ${
            showFilters || activeFilterCount > 0 ? 'bg-[#7FB3FF] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-white text-[#7FB3FF] text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </header>

      {showFilters && (
        <div className="bg-white border-b border-gray-100 px-6 py-4 space-y-4">
          {myServices.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Service type</label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setServiceFilter('')}
                  className={`px-3 py-1.5 rounded-full border text-xs transition ${
                    !serviceFilter ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9] font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  All
                </button>
                {myServices.map((svc: string) => (
                  <button key={svc} onClick={() => setServiceFilter(serviceFilter === svc ? '' : svc)}
                    className={`px-3 py-1.5 rounded-full border text-xs transition ${
                      serviceFilter === svc ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9] font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    {SERVICE_LABELS[svc] || svc}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Distance
              {!hasZip && <span className="font-normal text-gray-400 ml-1">(add your ZIP code in profile to enable)</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setMaxDistance(null)}
                className={`px-3 py-1.5 rounded-full border text-xs transition ${
                  maxDistance === null ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9] font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                Any distance
              </button>
              {DISTANCE_OPTIONS.map(d => (
                <button key={d} onClick={() => setMaxDistance(maxDistance === d ? null : d)}
                  disabled={!hasZip}
                  className={`px-3 py-1.5 rounded-full border text-xs transition disabled:opacity-40 ${
                    maxDistance === d ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9] font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  Within {d} mi
                </button>
              ))}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button onClick={() => { setServiceFilter(''); setMaxDistance(null) }}
              className="text-xs text-gray-400 hover:text-gray-600 underline">
              Clear all filters
            </button>
          )}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm">No open requests right now.</p>
            <p className="text-xs mt-1 text-gray-300">Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(r => {
              const familyUser = r.familyUser
              const alreadyApplied = myApplications.has(r.id)
              const appCount = r.matchCount || 0
              const scheduleDays = r.schedule_days || {}
              const sortedDays = DAY_ORDER.filter(d => scheduleDays[d])
              const isExpanded = expandedId === r.id
              const distance = requestDistances[r.id]

              // Abbreviated by public.display_name() before it left Postgres.
              const displayName = familyUser?.display_name || null

              return (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 transition overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      {familyUser?.avatar_url ? (
                        <img src={familyUser.avatar_url}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0 text-sm">
                          {displayName?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">
                            {displayName || 'A Family'}
                          </span>
                          {alreadyApplied && (
                            <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">✓ Connected</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400 flex-wrap">
                          <span>{SERVICE_LABELS[r.service_type] || r.service_type}</span>
                          {r.schedule_type && (
                            <span>· {r.schedule_type === 'recurring' ? '🔄 Recurring' : '1️⃣ One-time'}</span>
                          )}
                          {familyUser?.city && (
                            <span>· 📍 {familyUser.city}{familyUser.state ? `, ${familyUser.state}` : ''}</span>
                          )}
                          {distance !== undefined && (
                            <span className="text-[#7FB3FF] font-medium">· {distance < 1 ? '< 1' : Math.round(distance)} mi away</span>
                          )}
                          {appCount > 0 && <span>· {appCount} interested</span>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mb-3">
                      {(r.pay_min || r.pay_max) && (
                        <div className="flex items-center gap-1.5 text-gray-700">
                          <span>💰</span>
                          <span className="font-medium">${r.pay_min}{r.pay_max ? `–$${r.pay_max}` : '+'}/hr</span>
                        </div>
                      )}
                      {r.start_date && (
                        <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                          <span>📅</span>
                          <span>Starts {new Date(r.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      )}
                    </div>

                    {sortedDays.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-gray-400 mb-1">Schedule</div>
                        <div className="space-y-0.5">
                          {sortedDays.map(day => {
                            const times = scheduleDays[day]
                            return (
                              <div key={day} className="flex justify-between text-xs">
                                <span className="text-gray-600 capitalize w-24">{day}</span>
                                <span className="text-gray-500">{formatTime(times.start)} – {formatTime(times.end)}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {r.languages?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {r.languages.map((lang: string) => (
                          <span key={lang} className="text-xs bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">🗣 {lang}</span>
                        ))}
                      </div>
                    )}

                    {r.requirements?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {r.requirements.map((req: string) => (
                          <span key={req} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{req}</span>
                        ))}
                      </div>
                    )}

                    {r.ai_job_post && (
                      <div className="mb-3">
                        <button onClick={() => setExpandedId(isExpanded ? null : r.id)}
                          className="text-xs text-[#7FB3FF] hover:underline mb-1">
                          {isExpanded ? '▲ Hide description' : '▼ View job description'}
                        </button>
                        {isExpanded && (
                          <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl px-3 py-2 mt-1">
                            {r.ai_job_post}
                          </p>
                        )}
                      </div>
                    )}

                    {alreadyApplied ? (
                      <div className="w-full py-2.5 rounded-xl text-xs font-medium text-center bg-gray-50 text-gray-400 border border-gray-100">
                        ✓ Connected
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button onClick={() => handleApplyClick(r)}
                          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition"
                          style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                          📩 Apply Now
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {applyingTo && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => { setApplyingTo(null); setMessage('') }} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              {applyingTo.familyUser?.avatar_url ? (
                <img src={applyingTo.familyUser.avatar_url}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                  {applyingTo.familyUser?.display_name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">
                  Apply for {SERVICE_LABELS[applyingTo.service_type] || applyingTo.service_type}
                </h3>
                <p className="text-xs text-gray-400">
                  {(() => {
                    const name = applyingTo.familyUser?.display_name || 'Family'
                    return `${name}${(applyingTo.pay_min || applyingTo.pay_max) ? ` · $${applyingTo.pay_min}${applyingTo.pay_max ? `–$${applyingTo.pay_max}` : '+'}/hr` : ''}`
                  })()}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-3">Write a short intro message to the family</p>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder={`Hi! I'm interested in this ${applyingTo.service_type} position. I have experience with...`}
              rows={4}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF] resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => { setApplyingTo(null); setMessage('') }}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium">
                Cancel
              </button>
              <button onClick={submitApplication} disabled={applying === applyingTo.id}
                className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                {applying === applyingTo.id ? 'Sending...' : '📩 Send Application'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}