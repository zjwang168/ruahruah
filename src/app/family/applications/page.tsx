'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { notifyUser } from '@/lib/notifications'

const EXPERIENCE_LABELS: Record<string, string> = {
  '0': '< 1 yr', '1': '1–2 yrs', '3': '3–5 yrs', '5': '5–10 yrs', '10': '10+ yrs',
}

function ApplicationsContent() {
  const [user, setUser] = useState<any>(null)
  const [request, setRequest] = useState<any>(null)
  // "applications" here are caregiver-initiated matches for this request
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestId = searchParams.get('request')
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }
      setUser(authUser)

      if (!requestId) { router.push('/family/dashboard'); return }

      // Fetch request details
      const { data: requestData } = await supabase
        .from('service_requests')
        .select('*, family_profiles(user_id)')
        .eq('id', requestId)
        .single()

      setRequest(requestData)

      // Fetch caregiver-initiated matches for this request (the "applications")
      const { data: matchData } = await supabase
        .from('matches')
        .select(`
          *,
          caregiver_profiles (
            id, services, languages, hourly_rate_min, hourly_rate_max,
            years_experience, bio, is_verified, background_check_status,
            onboarding_answers,
            user_display ( id, display_name, avatar_url, city, state )
          )
        `)
        .eq('request_id', requestId)
        .eq('initiated_by', 'caregiver')
        .order('created_at', { ascending: false })

      setApplications(matchData || [])
      setLoading(false)
    }
    load()
  }, [requestId])

  // Family responds to a caregiver-initiated match.
  // Accept -> family_interested=true; if caregiver already interested -> mutual match (accepted).
  // Decline -> family_interested=false, status=declined.
  const updateStatus = async (matchId: string, action: 'accepted' | 'declined', caregiverUserId: string) => {
    setUpdating(matchId)

    if (action === 'accepted') {
      // Both sides interested → it's a match
      await supabase.from('matches')
        .update({ family_interested: true, status: 'accepted' })
        .eq('id', matchId)

      // Notify both parties — mine directly, hers through /api/notify.
      await supabase.from('notifications').insert({
        user_id: user?.id,
        type: 'mutual_match',
        title: "🎉 It's a match!",
        body: 'Both you and the caregiver are interested. You can now message each other!',
        data: { matchId, caregiverUserId }
      })
      await notifyUser({
        recipientUserId: caregiverUserId,
        type: 'mutual_match',
        title: "🎉 It's a match!",
        body: 'Both you and the family are interested. You can now message each other!',
        data: { matchId, familyUserId: user?.id }
      })

      setApplications(prev =>
        prev.map(a => a.id === matchId ? { ...a, family_interested: true, status: 'accepted' } : a)
      )
    } else {
      await supabase.from('matches')
        .update({ family_interested: false, status: 'declined' })
        .eq('id', matchId)

      await notifyUser({
        recipientUserId: caregiverUserId,
        type: 'application_declined',
        title: 'Application update',
        body: 'Thank you for applying. The family has decided to go in a different direction.',
        data: { requestId, familyUserId: user?.id }
      })

      setApplications(prev =>
        prev.map(a => a.id === matchId ? { ...a, family_interested: false, status: 'declined' } : a)
      )
    }

    setUpdating(null)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  // Pending = caregiver interested, family hasn't responded yet
  const pending = applications.filter(a => a.family_interested === null && a.status !== 'declined')
  const responded = applications.filter(a => a.family_interested !== null || a.status === 'declined')

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/family/dashboard')}
          className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div>
          <div className="font-semibold text-gray-900 text-sm">Applications</div>
          <div className="text-xs text-gray-400">
            {request?.service_type && <span className="capitalize">{request.service_type}</span>}
            {' · '}{applications.length} total
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Request summary */}
        {request?.ai_job_post && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                request.status === 'open' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
              }`}>{request.status}</span>
              <span className="text-xs text-gray-400 capitalize">{request.service_type}</span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{request.ai_job_post}</p>
          </div>
        )}

        {applications.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📩</div>
            <p className="text-sm">No applications yet.</p>
            <p className="text-xs mt-1 text-gray-300">Caregivers who apply will appear here.</p>
          </div>
        ) : (
          <>
            {/* Pending */}
            {pending.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">
                  New Applications
                  <span className="ml-2 bg-[#7FB3FF] text-white text-xs px-2 py-0.5 rounded-full">{pending.length}</span>
                </h2>
                <div className="space-y-4">
                  {pending.map(app => (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      updating={updating === app.id}
                      onAccept={() => updateStatus(app.id, 'accepted', app.caregiver_profiles?.user_display?.id)}
                      onDecline={() => updateStatus(app.id, 'declined', app.caregiver_profiles?.user_display?.id)}
                      onViewProfile={() => router.push(`/caregiver/${app.caregiver_profiles?.user_display?.id}`)}
                      onMessage={() => router.push(`/messages/${app.caregiver_profiles?.user_display?.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Responded */}
            {responded.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 mb-3">Already Responded</h2>
                <div className="space-y-4">
                  {responded.map(app => (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      updating={updating === app.id}
                      onAccept={() => updateStatus(app.id, 'accepted', app.caregiver_profiles?.user_display?.id)}
                      onDecline={() => updateStatus(app.id, 'declined', app.caregiver_profiles?.user_display?.id)}
                      onViewProfile={() => router.push(`/caregiver/${app.caregiver_profiles?.user_display?.id}`)}
                      onMessage={() => router.push(`/messages/${app.caregiver_profiles?.user_display?.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ApplicationCard({ app, updating, onAccept, onDecline, onViewProfile, onMessage }: {
  app: any
  updating: boolean
  onAccept: () => void
  onDecline: () => void
  onViewProfile: () => void
  onMessage: () => void
}) {
  const cp = app.caregiver_profiles
  const u = cp?.user_display
  const answers = cp?.onboarding_answers || {}
  // Derive display state from the unified match fields
  const isPending = app.family_interested === null && app.status !== 'declined'
  const isAccepted = app.status === 'accepted'
  const isDeclined = app.status === 'declined' || app.family_interested === false
  const message = app.initiator_message

  return (
    <div className={`bg-white rounded-2xl border p-5 transition ${
      isAccepted ? 'border-green-200'
      : isDeclined ? 'border-gray-100 opacity-60'
      : 'border-gray-100'
    }`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {u?.avatar_url
          ? <img src={u.avatar_url} className="w-12 h-12 rounded-full object-cover flex-shrink-0" alt="" />
          : <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold flex-shrink-0">
              {u?.display_name?.[0]?.toUpperCase() || '?'}
            </div>
        }

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{u?.display_name || 'Caregiver'}</span>
            {cp?.is_verified && (
              <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">✓ Verified</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              isAccepted ? 'bg-green-100 text-green-600'
              : isDeclined ? 'bg-gray-100 text-gray-500'
              : 'bg-blue-100 text-blue-500'
            }`}>
              {isPending ? 'New' : isAccepted ? 'matched' : 'declined'}
            </span>
          </div>

          {u?.city && u?.state && (
            <div className="text-xs text-gray-400 mt-0.5">📍 {u.city}, {u.state}</div>
          )}

          <div className="flex flex-wrap gap-x-3 mt-1.5 text-xs text-gray-500">
            {cp?.services?.length > 0 && <span>{cp.services.join(', ')}</span>}
            {cp?.languages?.length > 0 && <span>· {cp.languages.join(', ')}</span>}
            {cp?.hourly_rate_min && <span>· ${cp.hourly_rate_min}{cp.hourly_rate_max ? `–$${cp.hourly_rate_max}` : '+'}/hr</span>}
            {cp?.years_experience != null && <span>· {EXPERIENCE_LABELS[String(cp.years_experience)]}</span>}
          </div>

          {/* Caregiver's intro message */}
          {message && (
            <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2">
              <p className="text-xs text-gray-600 leading-relaxed">"{message}"</p>
            </div>
          )}

          {/* Bio snippet */}
          {cp?.bio && !message && (
            <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{cp.bio}</p>
          )}

          <div className="text-xs text-gray-300 mt-1.5">
            Applied {new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        {isPending ? (
          <>
            <button onClick={onAccept} disabled={updating}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 transition"
              style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
              {updating ? '...' : '✓ Accept'}
            </button>
            <button onClick={onViewProfile}
              className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:border-[#7FB3FF] hover:text-[#7FB3FF] transition">
              👤 View Profile
            </button>
            <button onClick={onDecline} disabled={updating}
              className="px-4 py-2 rounded-xl text-xs font-medium border border-gray-100 text-gray-400 hover:border-red-200 hover:text-red-400 transition">
              ✕
            </button>
          </>
        ) : isAccepted ? (
          <>
            <button onClick={onMessage}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white transition"
              style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
              💬 Message
            </button>
            <button onClick={onViewProfile}
              className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:border-[#7FB3FF] transition">
              👤 View Profile
            </button>
          </>
        ) : (
          <button onClick={onViewProfile}
            className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-500 hover:border-gray-300 transition">
            👤 View Profile
          </button>
        )}
      </div>
    </div>
  )
}

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>}>
      <ApplicationsContent />
    </Suspense>
  )
}