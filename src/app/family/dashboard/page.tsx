'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FamilyNav from '@/components/FamilyNav'
import { INTERNAL_NOTIFICATION_TYPE, isActionNotification } from '@/lib/notifications'
import { SELECTABLE_SERVICE_IDS } from '@/lib/services'

const SERVICE_LABELS: Record<string, string> = {
  childcare: '👶 Childcare',
  babysitter: '🍼 Babysitter',
  elder_care: '🏥 Elder Care',
  housekeeping: '🏠 Housekeeping',
  chef: '👨‍🍳 Personal Chef',
  pet_care: '🐾 Pet Care',
  tutoring: '📚 Tutoring',
  postpartum: '🌸 Postpartum',
}

// What a family can add today — childcare only. SERVICE_LABELS above stays
// complete on purpose, so a service chosen before the childcare focus still
// renders as words rather than a raw enum value.
const ALL_SERVICES = SELECTABLE_SERVICE_IDS

export default function FamilyDashboard() {
  const [user, setUser] = useState<any>(null)
  const [familyProfile, setFamilyProfile] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeService, setActiveService] = useState<string | null>(null)
  const [showAddService, setShowAddService] = useState(false)
  const [addingServices, setAddingServices] = useState(false)
  const [selectedNewServices, setSelectedNewServices] = useState<string[]>([])
  const [approvingProposal, setApprovingProposal] = useState<string | null>(null)
  const [proposalNotice, setProposalNotice] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const approveProposal = async (matchId: string) => {
    setApprovingProposal(matchId)
    try {
      const res = await fetch('/api/approve-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      })
      const data = await res.json()
      if (!res.ok) { setProposalNotice(data.error || 'Approval failed — try again.'); return }
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'pending', family_interested: true } : m))
      setProposalNotice(data.outreach === 'sent'
        ? `Approved — Ruah reached out to ${data.caregiver}.`
        : `Approved. ${data.reason}`)
    } finally {
      setApprovingProposal(null)
    }
  }

  const declineProposal = async (matchId: string) => {
    await supabase.from('matches')
      .update({ family_interested: false, status: 'declined' })
      .eq('id', matchId)
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'declined', family_interested: false } : m))
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      const { data: familyData } = await supabase.from('family_profiles').select('*').eq('user_id', authUser.id).single()
      const { data: notifData } = await supabase.from('notifications').select('*').eq('user_id', authUser.id).neq('type', INTERNAL_NOTIFICATION_TYPE).order('created_at', { ascending: false }).limit(10)

      let requestsData: any[] = []
      if (familyData?.id) {
        const { data } = await supabase
          .from('service_requests')
          .select('*, matches(id, status)')
          .eq('family_id', familyData.id)
          .order('created_at', { ascending: false })
        requestsData = data || []
      }

      let matchesData: any[] = []
      if (familyData?.id) {
        const { data } = await supabase
          .from('matches')
          .select(`*, service_requests!inner(family_id, service_type), caregiver_profiles(user_id, services, languages, hourly_rate_min, hourly_rate_max, years_experience, bio, is_verified, onboarding_answers, users(full_name, email, avatar_url))`)
          .eq('service_requests.family_id', familyData.id)
          .order('created_at', { ascending: false })
        matchesData = data || []
      }

      const onboardingServices: string[] = familyData?.onboarding_answers?.services || []
      const requestServices = [...new Set((requestsData || []).map((r: any) => r.service_type).filter(Boolean))]
      const mergedServices = [...new Set([...onboardingServices, ...requestServices])]

      setUser(userData)
      setFamilyProfile(familyData)
      setNotifications(notifData || [])
      setRequests(requestsData)
      setMatches(matchesData)
      if (mergedServices.length > 0) setActiveService(mergedServices[0])
      setLoading(false)
    }
    load()
  }, [])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const saveNewServices = async () => {
    if (selectedNewServices.length === 0) { setShowAddService(false); return }
    setAddingServices(true)
    const currentServices: string[] = familyProfile?.onboarding_answers?.services || []
    const merged = [...new Set([...currentServices, ...selectedNewServices])]
    const updatedAnswers = { ...(familyProfile?.onboarding_answers || {}), services: merged }
    await supabase.from('family_profiles').update({ onboarding_answers: updatedAnswers }).eq('user_id', user.id)
    setFamilyProfile((prev: any) => ({ ...prev, onboarding_answers: updatedAnswers }))
    setSelectedNewServices([])
    setAddingServices(false)
    setShowAddService(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  const unreadCount = notifications.filter(n => !n.read).length
  const hasRequests = requests.length > 0

  const onboardingServices: string[] = familyProfile?.onboarding_answers?.services || []
  const requestServices = [...new Set(requests.map(r => r.service_type).filter(Boolean))]
  const serviceList = [...new Set([...onboardingServices, ...requestServices])]

  const filteredRequests = activeService
    ? requests.filter(r => r.service_type === activeService)
    : requests
  const filteredMatches = activeService
    ? matches.filter(m => m.service_requests?.service_type === activeService)
    : matches

  // Action items first, then FYI, capped at 3 total for the preview.
  const actionNotifs = notifications.filter(isActionNotification)
  const infoNotifs = notifications.filter(n => !isActionNotification(n))
  const previewAction = actionNotifs.slice(0, 3)
  const previewInfo = infoNotifs.slice(0, Math.max(0, 3 - previewAction.length))
  const availableToAdd = ALL_SERVICES.filter(s => !serviceList.includes(s))

  const renderNotif = (n: any) => (
    <div key={n.id}
      onClick={() => markAsRead(n.id)}
      className={`flex items-start gap-3 cursor-pointer rounded-xl p-3 transition ${!n.read ? 'bg-blue-50/40' : ''}`}>
      <div className="text-xl mt-0.5">
        {n.type === 'new_match' ? '🎯' : n.type === 'mutual_match' ? '🎉' : n.type === 'caregiver_interested' ? '🎉' : n.type === 'message' ? '💬' : '📬'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{n.title}</div>
        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{n.body}</div>
      </div>
      {!n.read && <div className="w-2 h-2 bg-[#7FB3FF] rounded-full flex-shrink-0 mt-1.5" />}
    </div>
  )

  // Ruah's summary of the match inbox state (for dashboard preview) — derived
  // from what the agent actually did: proposals queued for approval, deadlines
  // recorded on matches, quiet introductions closed. Closed matches never
  // count as "waiting on you".
  const isOpenMatch = (m: any) => !['stalled', 'declined', 'pending_family_approval', 'hired', 'closed'].includes(m.status)
  const openMatches = filteredMatches.filter(isOpenMatch)
  const proposalCount = filteredMatches.filter(m => m.status === 'pending_family_approval').length
  const needsResponseCount = openMatches.filter(m => m.family_interested === null && m.status !== 'accepted').length
  const inProgressCount = openMatches.filter(m => m.family_interested === true && m.status !== 'accepted').length
  const matchedCount = openMatches.filter(m => m.status === 'accepted').length
  const closedRecently = notifications.filter(n =>
    n.type === 'match_closed' && Date.now() - new Date(n.created_at).getTime() < 7 * 86400_000
  ).length
  const nextDeadlineTs = openMatches
    .map(m => (m.expires_at ? new Date(m.expires_at).getTime() : 0))
    .filter(t => t > Date.now())
    .sort((a, b) => a - b)[0]
  const nextDeadline = nextDeadlineTs
    ? new Date(nextDeadlineTs).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : null

  const summarySentences: string[] = []
  if (proposalCount > 0) {
    summarySentences.push(`I found ${proposalCount} new caregiver${proposalCount > 1 ? 's' : ''} for you — approve before anyone is contacted.`)
  }
  if (needsResponseCount > 0) {
    summarySentences.push(`${needsResponseCount} caregiver${needsResponseCount > 1 ? 's are' : ' is'} waiting for your response.`)
  }
  if (matchedCount > 0) {
    summarySentences.push(`You have ${matchedCount} active match${matchedCount > 1 ? 'es' : ''} 🎉`)
  }
  if (inProgressCount > 0) {
    summarySentences.push(nextDeadline
      ? `I've reached out to ${inProgressCount} caregiver${inProgressCount > 1 ? 's' : ''} and will update you by ${nextDeadline} either way.`
      : `I've reached out to ${inProgressCount} caregiver${inProgressCount > 1 ? 's' : ''} — waiting to hear back.`)
  } else if (nextDeadline) {
    summarySentences.push(`I'll update you by ${nextDeadline} either way.`)
  }
  if (closedRecently > 0) {
    summarySentences.push(`${closedRecently} quiet introduction${closedRecently > 1 ? 's were' : ' was'} closed this week so you're not left waiting.`)
  }
  const matchesSummary = summarySentences.slice(0, 2).join(' ') ||
    `I'm keeping an eye out for great caregivers for your family.`

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <FamilyNav userName={user?.full_name} unreadCount={unreadCount} />

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.full_name?.split(' ')[0]}! 👨‍👩‍👧
          </h1>
          <p className="text-gray-400 mt-1">Find the perfect care for your family</p>
        </div>

        {/* Service pills */}
        {serviceList.length > 0 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            {serviceList.map(svc => (
              <button
                key={svc}
                onClick={() => setActiveService(svc)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition border ${
                  activeService === svc
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}>
                {SERVICE_LABELS[svc] || svc}
              </button>
            ))}
            {availableToAdd.length > 0 && (
              <button
                onClick={() => { setSelectedNewServices([]); setShowAddService(true) }}
                className="px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-300 text-gray-400 hover:border-[#7FB3FF] hover:text-[#7FB3FF] transition">
                + Add service
              </button>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className={`grid gap-4 mb-6 ${hasRequests ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {hasRequests && (
            <button
              onClick={() => router.push('/family/post')}
              className="p-6 rounded-2xl text-left transition"
              style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)', boxShadow: '0 8px 32px rgba(127, 179, 255, 0.3)' }}>
              <div className="text-2xl mb-2">✍️</div>
              <div className="font-semibold text-white">Post a Request</div>
              <div className="text-sm text-white/70 mt-1">Full-time, after-school, or the occasional evening</div>
            </button>
          )}

          <button
            onClick={() => router.push('/search')}
            className="bg-gradient-to-r from-blue-50 to-purple-50 border border-[#7FB3FF]/30 p-6 rounded-2xl text-left hover:border-[#7FB3FF]/60 transition">
            <div className="text-2xl mb-2">🔍</div>
            <div className="font-semibold text-gray-900">Browse Caregivers</div>
            <div className="text-sm text-gray-500 mt-1">Search by service & location</div>
          </button>
        </div>

        {/* Post first request nudge */}
        {!hasRequests && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-[#7FB3FF]/30 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900 text-sm">
                  Post your first {activeService ? (SERVICE_LABELS[activeService] || activeService) : ''} request
                </div>
                <div className="text-xs text-gray-500 mt-1">Tell us what you need and our team will start matching you with caregivers!</div>
                <button
                  onClick={() => router.push('/family/post')}
                  className="mt-3 text-white px-4 py-2 rounded-xl text-xs font-semibold transition"
                  style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                  🚀 Post My Request →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ruah proposals — first-class NEEDS-YOU card, nobody contacted until approved */}
        {(() => {
          const proposalMatches = matches.filter(m => m.status === 'pending_family_approval')
          if (proposalMatches.length === 0 && !proposalNotice) return null
          const p = proposalMatches[0]
          const pName = p?.caregiver_profiles?.users?.full_name || 'A caregiver'
          const pReason = p ? String(p.ai_reasoning || '').replace(/^\[agent-proposed\]\s*/, '') : ''
          return (
            <div className="bg-white rounded-2xl border border-amber-300 p-5 mb-4">
              {proposalNotice && (
                <div className="flex items-start justify-between gap-3 bg-[#EAF4FF] rounded-xl px-3 py-2 mb-3">
                  <p className="text-xs text-gray-700">{proposalNotice}</p>
                  <button onClick={() => setProposalNotice(null)} className="text-gray-400 text-xs leading-none">✕</button>
                </div>
              )}
              {p && (
                <>
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-white rounded-full px-2.5 py-1 mb-2 bg-[#B45309]">
                    Needs you
                  </span>
                  <div className="text-sm font-semibold text-gray-900">
                    {pName} — proposed for your {p.service_requests?.service_type || 'care'} request
                  </div>
                  {pReason && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{pReason}</p>}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => approveProposal(p.id)}
                      disabled={approvingProposal === p.id}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                      {approvingProposal === p.id ? 'Approving…' : 'Approve — Ruah reaches out'}
                    </button>
                    <button
                      onClick={() => declineProposal(p.id)}
                      className="px-4 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-400 transition">
                      Not now
                    </button>
                  </div>
                  {proposalMatches.length > 1 && (
                    <button onClick={() => router.push('/family/matches')}
                      className="w-full mt-2 text-xs text-[#4A90D9] hover:underline text-center">
                      +{proposalMatches.length - 1} more proposal{proposalMatches.length > 2 ? 's' : ''} →
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })()}

        {/* My Matches preview — Ruah summarizes, details live in the inbox */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">My Matches</h2>
            {needsResponseCount > 0 && (
              <span className="bg-[#7FB3FF] text-white text-xs px-2 py-0.5 rounded-full">
                {needsResponseCount} need{needsResponseCount > 1 ? '' : 's'} you
              </span>
            )}
          </div>

          {filteredMatches.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">🎯</div>
              <p className="text-sm">No matches yet.</p>
              <p className="text-xs mt-1 text-gray-300">Ask Ruah to find caregivers, or post a request to get started!</p>
            </div>
          ) : (
            <>
              {/* Ruah's one-line summary of the inbox state */}
              <div className="flex items-start gap-3 bg-gradient-to-r from-[#EAF4FF] to-[#FFF6F2] rounded-xl px-4 py-3 mb-4">
                <img src="/ruah-logo.png" alt="Ruah" className="w-6 h-6 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700 leading-snug">{matchesSummary}</p>
              </div>
              <button
                onClick={() => router.push('/family/matches')}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition"
                style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                View all matches →
              </button>
            </>
          )}
        </div>

        {/* My Requests preview */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">My Requests</h2>
            <button onClick={() => router.push('/family/requests')} className="text-sm text-[#7FB3FF] hover:underline">
              {filteredRequests.length > 0 ? `See all ${filteredRequests.length} →` : '+ New'}
            </button>
          </div>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-sm">No requests yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRequests.slice(0, 3).map(r => (
                <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {SERVICE_LABELS[r.service_type] || r.service_type}
                    </span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                      r.status === 'open' ? 'bg-green-100 text-green-600'
                      : r.status === 'filled' ? 'bg-gray-100 text-gray-500'
                      : 'bg-yellow-100 text-yellow-600'
                    }`}>{r.status}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    Posted {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
              {filteredRequests.length > 3 && (
                <button onClick={() => router.push('/family/requests')} className="w-full pt-2 text-sm text-[#7FB3FF] hover:underline text-center">
                  + {filteredRequests.length - 3} more →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        {(previewAction.length > 0 || previewInfo.length > 0) && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Recent Activity</h2>
              {notifications.length > 3 && (
                <button onClick={() => router.push('/family/activity')} className="text-sm text-[#7FB3FF] hover:underline">
                  See all →
                </button>
              )}
            </div>
            <div className="space-y-3">
              {previewAction.length > 0 && (
                <>
                  <p className="text-[11px] font-semibold text-[#4A90D9] uppercase tracking-wide">Needs your action</p>
                  {previewAction.map(renderNotif)}
                </>
              )}
              {previewInfo.length > 0 && (
                <>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">For your information</p>
                  {previewInfo.map(renderNotif)}
                </>
              )}
            </div>
          </div>
        )}

        {/* AI Assistant */}
        <div className="bg-gradient-to-br from-[#EAF4FF] to-[#FFF6F2] rounded-2xl p-6 border border-blue-50">
          <div className="flex items-start gap-4">
            <img src="/ruah-logo.png" alt="Ruah" className="w-12 h-12 flex-shrink-0" />
            <div>
              <div className="font-semibold text-gray-900">Hi, I'm Ruah! Your AI Assistant ✨</div>
              <div className="text-sm text-gray-500 mt-1">Let me help you write your job post and prepare interview questions.</div>
              <button
                onClick={() => router.push('/family/chat')}
                className="mt-3 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                Chat with Ruah! →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Service Modal */}
      {showAddService && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Add a service</h3>
            <p className="text-xs text-gray-400 mb-4">Select the services you're looking for</p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {availableToAdd.map(svc => (
                <button
                  key={svc}
                  onClick={() => setSelectedNewServices(prev =>
                    prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc]
                  )}
                  className={`p-3 rounded-xl border text-left text-sm transition ${
                    selectedNewServices.includes(svc)
                      ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9] font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {SERVICE_LABELS[svc]}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddService(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
                Cancel
              </button>
              <button
                onClick={saveNewServices}
                disabled={addingServices || selectedNewServices.length === 0}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition"
                style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                {addingServices ? 'Saving...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}