'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FamilyNav from '@/components/FamilyNav'
import { notifyUser } from '@/lib/notifications'

const EXPERIENCE_LABELS: Record<string, string> = {
  '0': '< 1 yr', '1': '1–2 yrs', '3': '3–5 yrs', '5': '5–10 yrs', '10': '10+ yrs',
}

// Ruah's narration line for each match, varying by who initiated it and its state.
// This is the connective tissue that makes every path feel like one product.
function ruahNarration(m: any, caregiverName: string): string {
  if (m.status === 'pending_family_approval') {
    return `I found ${caregiverName} for you. Nobody is contacted until you approve.`
  }
  if (m.status === 'hired') {
    return `You hired ${caregiverName}. I've closed this out as a success.`
  }
  if (m.status === 'closed') {
    return `You closed this arrangement with ${caregiverName}.`
  }
  if (m.status === 'stalled') {
    return `${caregiverName} didn't reply, so I closed this one and let you know.`
  }
  if (m.status === 'accepted') {
    return `🎉 You and ${caregiverName} are both interested — you can start chatting now!`
  }
  if (m.family_interested === false || m.status === 'declined') {
    return m.decline_reason
      ? `${caregiverName} passed (${String(m.decline_reason).replace(/_/g, ' ')}). I'll look for alternatives.`
      : `You passed on ${caregiverName}.`
  }
  // Still needs action or waiting
  if (m.initiated_by === 'caregiver') {
    return `${caregiverName} saw your request and is interested. Want me to set up a chat?`
  }
  if (m.initiated_by === 'admin') {
    return `I found ${caregiverName} for you — looks like a strong match.`
  }
  // family-initiated (AI reached out on their behalf)
  if (m.family_interested === true) {
    return `I reached out to ${caregiverName} for you — waiting to hear back.`
  }
  return `I think ${caregiverName} could be a great fit for your family.`
}

type Group = {
  key: string
  title: string
  hint: string
  matches: any[]
}

export default function FamilyMatchesPage() {
  const [user, setUser] = useState<any>(null)
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [approving, setApproving] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // Two-tap confirm for hire/close: holds `${matchId}:hire` or `${matchId}:close`
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const approveProposal = async (matchId: string) => {
    setApproving(matchId)
    try {
      const res = await fetch('/api/approve-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      })
      const data = await res.json()
      if (!res.ok) { setNotice(data.error || 'Approval failed — try again.'); return }
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'pending', family_interested: true } : m))
      setNotice(data.outreach === 'sent'
        ? `Approved — Ruah reached out to ${data.caregiver}.`
        : `Approved. ${data.reason}`)
    } finally {
      setApproving(null)
    }
  }

  const declineProposal = async (matchId: string) => {
    await supabase.from('matches')
      .update({ family_interested: false, status: 'declined' })
      .eq('id', matchId)
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'declined', family_interested: false } : m))
  }

  const hireMatch = async (m: any) => {
    setConfirmKey(null)
    await supabase.from('matches').update({ status: 'hired' }).eq('id', m.id)
    if (m.request_id) {
      await supabase.from('service_requests').update({ status: 'filled' }).eq('id', m.request_id)
    }
    const caregiverUserId = m.caregiver_profiles?.user_id
    const caregiverName = m.caregiver_profiles?.users?.full_name || 'the caregiver'
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'message',
      title: `You hired ${caregiverName}`,
      body: 'Marked as hired — your request is filled and Ruah stops working this match.',
      data: { matchId: m.id, isAi: true },
    })
    if (caregiverUserId) await notifyUser({
      recipientUserId: caregiverUserId,
      type: 'message',
      title: `${user.full_name || 'The family'} confirmed the hire`,
      body: 'The family marked this arrangement as confirmed. Congratulations!',
      data: { matchId: m.id, isAi: true },
    })
    setMatches(prev => prev.map(x => x.id === m.id ? { ...x, status: 'hired' } : x))
    setNotice(`Confirmed — you hired ${caregiverName}.`)
  }

  const closeMatch = async (m: any) => {
    setConfirmKey(null)
    await supabase.from('matches').update({ status: 'closed' }).eq('id', m.id)
    const caregiverUserId = m.caregiver_profiles?.user_id
    if (caregiverUserId) {
      // She was part of an accepted arrangement — she is owed the outcome.
      await notifyUser({
        recipientUserId: caregiverUserId,
        type: 'match_closed',
        title: 'An arrangement was closed',
        body: `${user.full_name || 'The family'} closed this arrangement. Nothing further is needed from you.`,
        data: { matchId: m.id, isAi: true, closed: true },
      })
    }
    setMatches(prev => prev.map(x => x.id === m.id ? { ...x, status: 'closed' } : x))
    setNotice('Closed. Your request stays open and Ruah keeps looking.')
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const { data: userData } = await supabase.from('user_self').select('*').single()
      const { data: familyData } = await supabase.from('family_profiles').select('*').eq('user_id', authUser.id).single()
      const { data: notifData } = await supabase.from('notifications').select('id, read').eq('user_id', authUser.id).neq('type', 'admin_escalation')

      let matchesData: any[] = []
      if (familyData?.id) {
        const { data } = await supabase
          .from('matches')
          .select(`*, service_requests!inner(family_id, service_type), caregiver_profiles(user_id, services, languages, hourly_rate_min, hourly_rate_max, years_experience, bio, is_verified, onboarding_answers, users(full_name, avatar_url))`)
          .eq('service_requests.family_id', familyData.id)
          .order('created_at', { ascending: false })
        matchesData = data || []
      }

      setUser(userData)
      setMatches(matchesData)
      setUnreadCount((notifData || []).filter(n => !n.read).length)
      setLoading(false)
    }
    load()
  }, [])

  const triggerMutualMatch = async (matchId: string, caregiverUserId: string) => {
    await supabase.from('matches').update({ status: 'accepted' }).eq('id', matchId)
    // Own notification: a direct insert is fine, RLS allows user_id = auth.uid().
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'mutual_match',
      title: '🎉 It\'s a match!',
      body: 'Both you and the caregiver are interested. You can now message each other!',
      data: { matchId, caregiverUserId }
    })
    // Hers is cross-user, so it goes through /api/notify.
    await notifyUser({
      recipientUserId: caregiverUserId,
      type: 'mutual_match',
      title: '🎉 It\'s a match!',
      body: 'Both you and the family are interested. You can now message each other!',
      data: { matchId, familyUserId: user.id }
    })
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'accepted', family_interested: true } : m))
  }

  const updateMatchInterest = async (matchId: string, interested: boolean) => {
    await supabase.from('matches')
      .update({ family_interested: interested, ...(interested ? {} : { status: 'declined' }) })
      .eq('id', matchId)
    setMatches(prev => prev.map(m => m.id === matchId
      ? { ...m, family_interested: interested, ...(interested ? {} : { status: 'declined' }) }
      : m))

    if (interested) {
      const { data: matchData } = await supabase
        .from('matches').select('*, caregiver_profiles(user_id)').eq('id', matchId).single()
      if (matchData?.caregiver_interested === true) {
        await triggerMutualMatch(matchId, matchData.caregiver_profiles?.user_id)
      }
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  // Group matches into the unified inbox structure. Terminal and
  // awaiting-approval states must never masquerade as "waiting on you".
  const CLOSED_STATUSES = ['declined', 'stalled', 'closed']
  const proposals = matches.filter(m => m.status === 'pending_family_approval')
  const needsResponse = matches.filter(m =>
    m.family_interested === null &&
    !['accepted', 'hired', 'pending_family_approval', ...CLOSED_STATUSES].includes(m.status)
  )
  const inProgress = matches.filter(m =>
    m.family_interested === true &&
    !['accepted', 'hired', 'pending_family_approval', ...CLOSED_STATUSES].includes(m.status)
  )
  const matched = matches.filter(m => m.status === 'accepted')
  const hired = matches.filter(m => m.status === 'hired')
  const passed = matches.filter(m =>
    m.family_interested === false || CLOSED_STATUSES.includes(m.status)
  )

  const groups: Group[] = [
    { key: 'proposals', title: 'Ruah proposed', hint: 'Nobody is contacted until you approve', matches: proposals },
    { key: 'needs', title: 'Needs your response', hint: 'Caregivers waiting to hear from you', matches: needsResponse },
    { key: 'progress', title: 'In progress', hint: "You're interested — waiting on the caregiver", matches: inProgress },
    { key: 'matched', title: 'Matched 🎉', hint: 'Both interested — start chatting', matches: matched },
    { key: 'hired', title: 'Hired', hint: '', matches: hired },
    { key: 'passed', title: 'Closed', hint: '', matches: passed },
  ]

  const totalActive = matches.filter(m =>
    m.family_interested !== false && !['hired', ...CLOSED_STATUSES].includes(m.status)
  ).length

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <FamilyNav userName={user?.full_name} unreadCount={unreadCount} />

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => router.push('/family/dashboard')}
            className="text-gray-400 hover:text-gray-600 text-sm">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">My Matches</h1>
        </div>
        <p className="text-gray-400 text-sm mb-6">Ruah keeps track of everyone interested in working with you.</p>

        {notice && (
          <div className="flex items-start justify-between gap-3 bg-[#EAF4FF] border border-blue-100 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-gray-700">{notice}</p>
            <button onClick={() => setNotice(null)} className="text-gray-400 hover:text-gray-600 text-sm leading-none">✕</button>
          </div>
        )}

        {matches.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-sm">No matches yet.</p>
            <p className="text-xs mt-1 text-gray-300">Ask Ruah to find caregivers, or post a request to get started!</p>
            <button onClick={() => router.push('/family/chat')}
              className="mt-4 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition"
              style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
              ✨ Chat with Ruah
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map(group => {
              if (group.matches.length === 0) return null
              return (
                <div key={group.key}>
                  <div className="flex items-baseline gap-2 mb-3">
                    <h2 className="font-semibold text-gray-900">{group.title}</h2>
                    <span className="text-xs text-gray-400">{group.matches.length}</span>
                  </div>
                  {group.hint && group.key === 'needs' && (
                    <p className="text-xs text-gray-400 -mt-2 mb-3">{group.hint}</p>
                  )}
                  <div className="space-y-4">
                    {group.matches.map(m => {
                      const cp = m.caregiver_profiles
                      const caregiverUser = cp?.users
                      const caregiverName = caregiverUser?.full_name || 'this caregiver'
                      const firstName = caregiverName.split(' ')[0]
                      const isProposal = m.status === 'pending_family_approval'
                      const isHired = m.status === 'hired'
                      const isClosed = m.family_interested === false || CLOSED_STATUSES.includes(m.status)
                      const isPending = m.family_interested === null && !isProposal && !isClosed && m.status !== 'accepted' && !isHired
                      const isMutual = m.status === 'accepted'
                      const isPassed = isClosed

                      return (
                        <div key={m.id} className={`bg-white rounded-2xl border overflow-hidden transition ${
                          isProposal ? 'border-amber-300'
                          : isMutual || isHired ? 'border-green-200'
                          : isPassed ? 'border-gray-100 opacity-50'
                          : m.initiated_by === 'caregiver' ? 'border-[#7FB3FF]/40'
                          : 'border-gray-100'
                        }`}>
                          {/* Ruah narration bar */}
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#EAF4FF] to-[#FFF6F2] border-b border-blue-50">
                            <img src="/ruah-logo.png" alt="Ruah" className="w-5 h-5 flex-shrink-0" />
                            <p className="text-xs text-gray-600 leading-snug">{ruahNarration(m, firstName)}</p>
                          </div>

                          <div className="p-5">
                            <div className="flex items-start gap-3">
                              {caregiverUser?.avatar_url
                                ? <img src={caregiverUser.avatar_url} className="w-12 h-12 rounded-full object-cover flex-shrink-0" alt="" />
                                : <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold flex-shrink-0 text-lg">
                                    {caregiverName[0]?.toUpperCase() || '?'}
                                  </div>
                              }
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-gray-900 text-sm">{caregiverName}</span>
                                  {cp?.is_verified && <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">✓ Verified</span>}
                                </div>
                                <div className="flex flex-wrap gap-x-3 mt-1">
                                  {cp?.services?.length > 0 && <span className="text-xs text-gray-500">{cp.services.join(', ')}</span>}
                                  {cp?.languages?.length > 0 && <span className="text-xs text-gray-400">· {cp.languages.join(', ')}</span>}
                                  {cp?.hourly_rate_min && cp?.hourly_rate_max && <span className="text-xs text-gray-400">· ${cp.hourly_rate_min}–${cp.hourly_rate_max}/hr</span>}
                                  {cp?.years_experience != null && <span className="text-xs text-gray-400">· {EXPERIENCE_LABELS[String(cp.years_experience)]}</span>}
                                </div>
                                {cp?.bio && <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{cp.bio}</p>}
                                {/* Caregiver's own intro message (if they applied) */}
                                {m.initiated_by === 'caregiver' && m.initiator_message && (
                                  <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2">
                                    <p className="text-xs text-gray-600 leading-relaxed">"{m.initiator_message}"</p>
                                  </div>
                                )}
                                {/* AI reasoning (if AI/admin matched) */}
                                {m.initiated_by !== 'caregiver' && m.ai_reasoning && m.ai_reasoning !== 'Manually matched by admin' && (
                                  <p className="text-xs text-[#7FB3FF] mt-1.5 italic line-clamp-2">"{String(m.ai_reasoning).replace(/^\[agent-proposed\]\s*/, '')}"</p>
                                )}
                              </div>
                            </div>

                            {isPending && m.expires_at && (
                              <div className="mt-2 text-xs text-gray-400">
                                ⏰ Expires {new Date(m.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}

                            {/* Proposal: the NEEDS-YOU card — approve before anyone is contacted */}
                            {isProposal && (
                              <div className="mt-3">
                                <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-white rounded-full px-2.5 py-1 mb-2 bg-[#B45309]">
                                  Needs you
                                </span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => approveProposal(m.id)}
                                    disabled={approving === m.id}
                                    className="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60"
                                    style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                                    {approving === m.id ? 'Approving…' : 'Approve — Ruah reaches out'}
                                  </button>
                                  <button
                                    onClick={() => router.push(`/caregiver/${cp?.user_id}`)}
                                    className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:border-[#7FB3FF] transition">
                                    View profile
                                  </button>
                                  <button
                                    onClick={() => declineProposal(m.id)}
                                    className="px-4 py-2 rounded-xl text-xs font-medium border border-gray-100 text-gray-400 hover:border-red-200 hover:text-red-400 transition">
                                    ✕
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            {isPending && (
                              <div className="flex gap-2 mt-3">
                                <button onClick={() => updateMatchInterest(m.id, true)}
                                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-white"
                                  style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                                  {m.initiated_by === 'caregiver' ? '✓ Set up a chat' : "✓ I'm Interested"}
                                </button>
                                <button onClick={() => router.push(`/caregiver/${cp?.user_id}`)}
                                  className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:border-[#7FB3FF] hover:text-[#7FB3FF] transition">
                                  👤 View Profile
                                </button>
                                <button onClick={() => updateMatchInterest(m.id, false)}
                                  className="px-4 py-2 rounded-xl text-xs font-medium border border-gray-100 text-gray-400 hover:border-red-200 hover:text-red-400 transition">
                                  ✕
                                </button>
                              </div>
                            )}

                            {m.family_interested === true && !isMutual && (
                              <div className="mt-3">
                                <div className="px-3 py-2 bg-yellow-50 rounded-xl text-xs text-yellow-600 text-center">
                                  ⏳ Waiting for {firstName} to respond...
                                </div>
                                <button
                                  onClick={() => router.push(`/messages/${cp?.user_id}`)}
                                  className="w-full mt-1.5 text-xs text-[#4A90D9] hover:underline text-center py-1">
                                  See what Ruah sent on your behalf →
                                </button>
                              </div>
                            )}

                            {(isMutual || isHired) && (
                              <div className="flex gap-2 mt-3">
                                <button onClick={() => router.push(`/messages/${cp?.user_id}`)}
                                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-white"
                                  style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                                  💬 Message
                                </button>
                                <button onClick={() => router.push(`/caregiver/${cp?.user_id}`)}
                                  className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:border-[#7FB3FF] transition">
                                  👤 View Profile
                                </button>
                              </div>
                            )}

                            {/* Close the loop: accepted matches must not dead-end */}
                            {isMutual && (
                              <div className="flex gap-2 mt-2">
                                {confirmKey === `${m.id}:hire` ? (
                                  <button onClick={() => hireMatch(m)}
                                    className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-green-600">
                                    Tap again to confirm hire
                                  </button>
                                ) : (
                                  <button onClick={() => setConfirmKey(`${m.id}:hire`)}
                                    className="flex-1 py-2 rounded-xl text-xs font-semibold text-green-700 border border-green-200 hover:bg-green-50 transition">
                                    We hired {firstName}
                                  </button>
                                )}
                                {confirmKey === `${m.id}:close` ? (
                                  <button onClick={() => closeMatch(m)}
                                    className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-gray-600">
                                    Confirm close
                                  </button>
                                ) : (
                                  <button onClick={() => setConfirmKey(`${m.id}:close`)}
                                    className="px-4 py-2 rounded-xl text-xs font-medium border border-gray-100 text-gray-400 hover:border-gray-300 hover:text-gray-600 transition">
                                    Didn't work out
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
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