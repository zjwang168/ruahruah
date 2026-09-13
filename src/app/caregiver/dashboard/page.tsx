'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import RequestSummaryCard from '@/components/RequestSummaryCard'
import { notifyUser } from '@/lib/notifications'

// One-tap Pass reasons. "Not my service" is deliberately absent: if that's why
// she'd pass, the MATCH was wrong — detected objectively below and logged as a
// matching-layer signal instead of asked as a question.
const PASS_REASONS = [
  { value: 'schedule', label: 'Schedule conflict' },
  { value: 'distance', label: 'Too far' },
  { value: 'rate', label: 'Rate' },
  { value: 'not_taking_new_families', label: 'Not taking new families right now' },
]

export default function CaregiverDashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  // match_id -> { request, childrenAges, city } for outreach cards
  const [requestByMatch, setRequestByMatch] = useState<Record<string, any>>({})
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showTooltip, setShowTooltip] = useState(true)
  // Notification id whose Pass-reason chips are open
  const [passingNotif, setPassingNotif] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const { data: userData } = await supabase
        .from('user_self').select('*').single()
      const { data: caregiverData } = await supabase
        .from('caregiver_profiles').select('*').eq('user_id', authUser.id).single()
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', authUser.id)
        .neq('type', 'admin_escalation') // internal ops — admin surfaces only
        .order('created_at', { ascending: false })
        .limit(10)

      let appsData: any[] = []
      if (caregiverData?.id) {
        // "My applications" = caregiver-initiated matches by this caregiver
        const { data: rawApps } = await supabase
          .from('matches')
          .select(`*, service_requests(id, service_type, status, ai_job_post, created_at, family_profiles(user_id))`)
          .eq('caregiver_id', caregiverData.id)
          .eq('initiated_by', 'caregiver')
          .order('created_at', { ascending: false })

        const familyUserIds = [...new Set(
          (rawApps || []).map((a: any) => a.service_requests?.family_profiles?.user_id).filter(Boolean)
        )]

        let familyUsersMap: Record<string, any> = {}
        if (familyUserIds.length > 0) {
          // family_public, not `users`: full_name is no longer granted to
          // `authenticated`, and the view serves the abbreviation the card
          // renders anyway. Keyed by user_id — the view carries both ids.
          const { data: familyUsersData } = await supabase
            .from('family_public').select('user_id, display_name, avatar_url').in('user_id', familyUserIds)
          familyUsersData?.forEach((u: any) => { familyUsersMap[u.user_id] = u })
        }

        appsData = (rawApps || []).map((a: any) => ({
          ...a,
          familyUser: familyUsersMap[a.service_requests?.family_profiles?.user_id] || null
        }))
      }

      if (caregiverData?.id) {
        await supabase.from('caregiver_profiles')
          .update({ last_active_at: new Date().toISOString() })
          .eq('user_id', authUser.id)
      }

      // Structured request data for outreach notifications — the caregiver
      // evaluates a card with schedule/pay/location/ages, not prose alone.
      const outreachMatchIds = [...new Set(
        (notifData || [])
          .filter((n: any) => n.type === 'new_match' && n.data?.matchId)
          .map((n: any) => n.data.matchId)
      )]
      if (outreachMatchIds.length > 0) {
        const { data: matchRows } = await supabase
          .from('matches')
          .select('id, service_requests(*, family_profiles(children_ages, users(city)))')
          .in('id', outreachMatchIds)
        const map: Record<string, any> = {}
        for (const row of matchRows || []) {
          const req = (row as any).service_requests
          if (!req) continue
          map[(row as any).id] = {
            request: req,
            childrenAges: req.family_profiles?.children_ages || null,
            city: req.family_profiles?.users?.city || null,
          }
        }
        setRequestByMatch(map)
      }

      setUser(userData)
      setProfile(caregiverData)
      setNotifications(notifData || [])
      setApplications(appsData)
      setLoading(false)
    }
    load()

    const timer = setTimeout(() => setShowTooltip(false), 4000)
    return () => clearTimeout(timer)
  }, [])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const handleMatchInterest = async (n: any, interested: boolean) => {
    if (!n.data?.matchId) return
    await supabase.from('matches')
      .update({ caregiver_interested: interested, ...(interested ? {} : { status: 'declined' }) })
      .eq('id', n.data.matchId)

    if (interested) {
      const { data: matchData } = await supabase
        .from('matches')
        .select('*, service_requests(family_profiles(user_id))')
        .eq('id', n.data.matchId)
        .single()

      if (matchData?.family_interested === true) {
        const familyUserId = matchData.service_requests?.family_profiles?.user_id
        if (familyUserId) {
          await supabase.from('matches').update({ status: 'accepted' }).eq('id', n.data.matchId)
          await supabase.from('notifications').insert({
            user_id: user.id,
            type: 'mutual_match',
            title: '🎉 It\'s a match!',
            body: 'Both you and the family are interested. You can now message each other!',
            data: { matchId: n.data.matchId, familyUserId }
          })
          await notifyUser({
            recipientUserId: familyUserId,
            type: 'mutual_match',
            title: '🎉 It\'s a match!',
            body: 'Both you and the caregiver are interested. You can now message each other!',
            data: { matchId: n.data.matchId, caregiverUserId: user.id }
          })
          await markAsRead(n.id)
          router.push(`/messages/${familyUserId}`)
          return
        }
      }
    }
    await markAsRead(n.id)
    setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, read: true } : notif))
  }

  // One-tap Pass: immediately releases the match (declined), tells the family
  // with the reason, and — when the request's service isn't one she offers —
  // logs a matching-layer signal for admins. An explicit "no" is the behavior
  // we WANT from caregivers; it never counts against her.
  const submitPass = async (n: any, reason: string | null) => {
    const matchId = n.data?.matchId
    if (!matchId) return
    setPassingNotif(null)

    // decline_reason column ships in a separate migration — degrade gracefully
    // if it hasn't been applied yet.
    const { error } = await supabase.from('matches')
      .update({ caregiver_interested: false, status: 'declined', decline_reason: reason })
      .eq('id', matchId)
    if (error) {
      await supabase.from('matches')
        .update({ caregiver_interested: false, status: 'declined' })
        .eq('id', matchId)
    }

    const { data: matchData } = await supabase
      .from('matches')
      .select('id, service_requests(service_type, family_profiles(user_id))')
      .eq('id', matchId)
      .single()
    const sr = (matchData as any)?.service_requests
    const familyUserId = sr?.family_profiles?.user_id
    const serviceType = sr?.service_type
    const reasonLabel = PASS_REASONS.find(r => r.value === reason)?.label

    if (familyUserId) {
      await notifyUser({
        recipientUserId: familyUserId,
        type: 'match_declined',
        title: `${user.full_name || 'The caregiver'} passed on your ${serviceType || 'care'} request`,
        body: `${reasonLabel ? `Reason: ${reasonLabel.toLowerCase()}. ` : ''}Ruah will look for alternatives for you.`,
        data: { matchId, isAi: true },
      })
    }

    // Matching-layer signal: she was routed a service she doesn't offer.
    // The admin recipients are resolved server-side from the allowlist — the
    // browser no longer reads the users table to find them by email.
    if (serviceType && profile?.services?.length && !profile.services.includes(serviceType)) {
      await notifyUser({
        audience: 'admins',
        type: 'admin_escalation',
        title: 'Matching signal: service mismatch',
        body: `${user.full_name || 'A caregiver'} (services: ${profile.services.join(', ')}) was routed a ${serviceType} request and passed. Match ${matchId}.`,
        data: { matchId },
      })
    }

    await markAsRead(n.id)
    setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, read: true } : notif))
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  // Derive a display status from the unified match fields
  const displayStatus = (a: any) => {
    if (a.status === 'accepted' || a.status === 'hired') return 'accepted'
    if (a.status === 'declined' || a.status === 'closed' || a.family_interested === false) return 'declined'
    return 'pending'
  }

  const unreadCount = notifications.filter(n => !n.read).length
  const previewNotifs = notifications.slice(0, 3)
  const previewApps = applications.slice(0, 2)
  const acceptedApps = applications.filter(a => displayStatus(a) === 'accepted')
  const pendingApps = applications.filter(a => displayStatus(a) === 'pending')

  const isVerified = profile?.is_verified
  const completionItems = [
    { label: 'Basic info added', done: true },
    { label: 'Bio written', done: !!profile?.bio },
    { label: 'Location set', done: !!user?.zipcode },
    { label: 'Identity verified', done: isVerified },
  ]
  const completionPct = Math.round((completionItems.filter(i => i.done).length / completionItems.length) * 100)

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8" />
          <span className="text-lg font-bold text-[#7FB3FF]">Ruah!</span>
        </div>
        <div className="flex items-center gap-4">
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount} new</span>
          )}
          <button onClick={() => router.push('/caregiver/profile')}
            className="text-sm text-gray-600 hover:text-[#7FB3FF] transition">
            👋 {user?.full_name}
          </button>
          <button onClick={() => router.push('/messages')}
            className="text-sm text-gray-400 hover:text-gray-600">💬 Messages</button>
          <button onClick={handleSignOut}
            className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.full_name?.split(' ')[0]}! 🤝
          </h1>
          <p className="text-gray-400 mt-1">Find families looking for care</p>
        </div>

        {applications.length > 0 ? (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Applied', value: applications.length, icon: '📩' },
              { label: 'Accepted', value: acceptedApps.length, icon: '✅' },
              { label: 'Pending', value: pendingApps.length, icon: '⏳' },
            ].map(stat => (
              <div key={stat.label} className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
                <div className="text-2xl mb-1">{stat.icon}</div>
                <div className="text-xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-xs text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-[#7FB3FF]/30 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">✨</div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">Ready to find your first family?</div>
                <div className="text-xs text-gray-500 mt-1">Complete your profile and browse open requests to get started.</div>
                <button
                  onClick={() => router.push('/caregiver/requests')}
                  className="mt-3 text-white px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                  Browse requests →
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => router.push('/caregiver/requests')}
            className="p-6 rounded-2xl text-left transition"
            style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)', boxShadow: '0 8px 32px rgba(127, 179, 255, 0.3)' }}>
            <div className="text-2xl mb-2">📋</div>
            <div className="font-semibold text-white">Browse Requests</div>
            <div className="text-sm text-white/70 mt-1">Find families to help</div>
          </button>
          <button
            onClick={() => router.push('/caregiver/profile')}
            className="bg-white border border-gray-200 p-6 rounded-2xl text-left hover:border-[#7FB3FF] transition">
            <div className="text-2xl mb-2">👤</div>
            <div className="font-semibold text-gray-900">My Profile</div>
            <div className="text-sm text-gray-400 mt-1">Edit info & services</div>
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Profile completion</h2>
            <span className="text-sm font-medium text-[#7FB3FF]">{completionPct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
            <div className="h-2 rounded-full transition-all"
              style={{ width: `${completionPct}%`, background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }} />
          </div>
          <div className="space-y-2 mb-4">
            {completionItems.map(item => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                {item.done
                  ? <span className="text-green-500">✓</span>
                  : <span className="text-gray-300">○</span>}
                <span className={item.done ? 'text-gray-600' : 'text-gray-400'}>{item.label}</span>
              </div>
            ))}
          </div>
          {!isVerified && (
            <div
              onClick={() => router.push('/caregiver/verify')}
              className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 cursor-pointer hover:bg-amber-100 transition">
              <span className="text-xl">🛡️</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-amber-800">Complete identity verification</div>
                <div className="text-xs text-amber-600 mt-0.5">Verified caregivers get 3x more matches</div>
              </div>
              <span className="text-amber-400 text-sm">→</span>
            </div>
          )}
          {completionPct < 100 && (
            <button
              onClick={() => router.push('/caregiver/profile')}
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium border-2 border-[#7FB3FF] text-[#7FB3FF] hover:bg-blue-50 transition">
              Complete Profile →
            </button>
          )}
        </div>

        {previewNotifs.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Recent activity</h2>
              {notifications.length > 3 && (
                <button
                  onClick={() => router.push('/caregiver/activity')}
                  className="text-sm text-[#7FB3FF] hover:underline">
                  See all →
                </button>
              )}
            </div>
            <div className="space-y-3">
              {previewNotifs.map(n => (
                <div key={n.id} className={`rounded-xl p-3 ${!n.read ? 'bg-blue-50/40' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="text-xl mt-0.5">
                      {n.type === 'new_match' ? '🎯'
                        : n.type === 'mutual_match' ? '🎉'
                        : n.type === 'application_accepted' ? '✅'
                        : n.type === 'message' ? '💬' : '📬'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{n.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{n.body}</div>
                      <div className="text-xs text-gray-300 mt-1">
                        {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {!n.read && <div className="w-2 h-2 bg-[#7FB3FF] rounded-full flex-shrink-0 mt-1.5" />}
                  </div>

                  {n.type === 'new_match' && n.data?.matchId && requestByMatch[n.data.matchId] && (
                    <div className="mt-2">
                      <RequestSummaryCard
                        request={requestByMatch[n.data.matchId].request}
                        childrenAges={requestByMatch[n.data.matchId].childrenAges}
                        city={requestByMatch[n.data.matchId].city}
                      />
                    </div>
                  )}
                  {n.type === 'new_match' && n.data?.matchId && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => handleMatchInterest(n, true)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                        ✅ Interested
                      </button>
                      <button onClick={() => router.push('/caregiver/requests')}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600">
                        View post
                      </button>
                      <button onClick={() => setPassingNotif(passingNotif === n.id ? null : n.id)}
                        className="px-3 py-1.5 rounded-lg text-xs border border-gray-100 text-gray-400 hover:border-red-200 hover:text-red-400">
                        Pass
                      </button>
                    </div>
                  )}
                  {n.type === 'new_match' && n.data?.matchId && passingNotif === n.id && (
                    <div className="mt-2 bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-2">No problem — mind sharing why? (optional)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {PASS_REASONS.map(r => (
                          <button key={r.value}
                            onClick={() => submitPass(n, r.value)}
                            className="px-3 py-1.5 rounded-full text-xs border border-gray-200 text-gray-600 bg-white hover:border-[#7FB3FF] hover:text-[#4A90D9] transition">
                            {r.label}
                          </button>
                        ))}
                        <button
                          onClick={() => submitPass(n, null)}
                          className="px-3 py-1.5 rounded-full text-xs text-gray-400 hover:text-gray-600 transition">
                          Skip
                        </button>
                      </div>
                    </div>
                  )}
                  {n.type === 'mutual_match' && n.data?.familyUserId && (
                    <button onClick={() => { markAsRead(n.id); router.push(`/messages/${n.data.familyUserId}`) }}
                      className="w-full mt-2 py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                      💬 Start Chatting
                    </button>
                  )}
                  {n.type === 'message' && n.data?.senderId && (
                    <button onClick={() => { markAsRead(n.id); router.push(`/messages/${n.data.senderId}`) }}
                      className="w-full mt-2 py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                      💬 Reply
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {applications.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">My applications</h2>
              <button
                onClick={() => router.push('/caregiver/applications')}
                className="text-sm text-[#7FB3FF] hover:underline">
                See all {applications.length} →
              </button>
            </div>
            <div className="space-y-3">
              {previewApps.map(app => {
                const req = app.service_requests
                const familyUser = app.familyUser
                const familyUserId = req?.family_profiles?.user_id
                const status = displayStatus(app)
                // Abbreviated by public.display_name() before it left Postgres.
                const displayName = familyUser?.display_name || 'A Family'

                return (
                  <div key={app.id} className={`rounded-xl border p-3 ${
                    status === 'accepted' ? 'border-green-200 bg-green-50/20'
                    : status === 'declined' ? 'border-red-100 opacity-60'
                    : 'border-gray-100'
                  }`}>
                    <div className="flex items-center gap-3">
                      {familyUser?.avatar_url
                        ? <img src={familyUser.avatar_url} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
                        : <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {familyUser?.display_name?.[0]?.toUpperCase() || '?'}
                          </div>
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{displayName}</span>
                          <span className="text-xs text-gray-400 capitalize">{req?.service_type}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            status === 'accepted' ? 'bg-green-100 text-green-600'
                            : status === 'declined' ? 'bg-red-100 text-red-400'
                            : 'bg-yellow-100 text-yellow-600'
                          }`}>{status}</span>
                        </div>
                        <div className="text-xs text-gray-300 mt-0.5">
                          Applied {new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      {status === 'accepted' && familyUserId && (
                        <button onClick={() => router.push(`/messages/${familyUserId}`)}
                          className="text-xs px-3 py-1.5 rounded-lg text-white flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                          💬
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Floating Ruah AI button */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2 z-50">
        {showTooltip && (
          <div className="relative bg-gray-900 text-white text-xs px-3 py-2 rounded-xl rounded-br-sm max-w-40 text-center">
            ✨ Need help? Ask me!
            <div className="absolute bottom-[-6px] right-4 w-3 h-3 bg-gray-900 rotate-45" />
          </div>
        )}
        <button
          onClick={() => router.push('/caregiver/chat')}
          className="flex items-center gap-2 text-white pl-3 pr-4 py-3 rounded-full shadow-xl transition hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)',
            boxShadow: '0 8px 32px rgba(127,179,255,0.5)'
          }}>
          <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8" />
          <span className="text-sm font-semibold">Ask Ruah!</span>
        </button>
      </div>
    </div>
  )
}