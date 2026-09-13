'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const EXPERIENCE_LABELS: Record<string, string> = {
  '0': 'Less than 1 year',
  '1': '1–2 years',
  '3': '3–5 years',
  '5': '5–10 years',
  '10': '10+ years',
}

export default function AdminOperations() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'activity' | 'notifications' | 'matches'>('activity')
  const [drawer, setDrawer] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const [notifsRes, matchesRes, usersRes] = await Promise.all([
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('matches').select(`
          *,
          caregiver_profiles ( user_id, services, languages, hourly_rate_min, hourly_rate_max, years_experience, bio, is_verified, background_check_status, onboarding_answers ),
          service_requests ( family_admin ( user_id, onboarding_answers ) )
        `).order('created_at', { ascending: false }),
        supabase.from('users_admin').select('id, full_name, email, role, avatar_url, created_at').order('created_at', { ascending: false }).limit(20),
      ])
      setNotifications(notifsRes.data || [])
      setMatches(matchesRes.data || [])
      setUsers(usersRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const openUserDrawer = async (userId: string) => {
    setDrawer({ type: 'loading' })
    const { data: user } = await supabase
      .from('users_admin')
      .select(`
        id, full_name, email, role, avatar_url, created_at, is_banned, is_shadow_banned,
        family_admin ( onboarding_answers ),
        caregiver_profiles ( services, languages, hourly_rate_min, hourly_rate_max, years_experience, bio, is_verified, background_check_status, onboarding_answers )
      `)
      .eq('id', userId)
      .single()
    setDrawer({ type: 'user', data: user })
  }

  const openMatchDrawer = async (match: any) => {
    setDrawer({ type: 'loading' })
    const caregiverUserId = match.caregiver_profiles?.user_id
    const familyUserId = match.service_requests?.family_profiles?.user_id

    const [caregiverRes, familyRes] = await Promise.all([
      caregiverUserId
        ? supabase.from('users_admin').select(`id, full_name, email, role, avatar_url, created_at, is_banned, is_shadow_banned, caregiver_profiles ( services, languages, hourly_rate_min, hourly_rate_max, years_experience, bio, is_verified, background_check_status, onboarding_answers )`).eq('id', caregiverUserId).single()
        : Promise.resolve({ data: null }),
      familyUserId
        ? supabase.from('users_admin').select(`id, full_name, email, role, avatar_url, created_at, is_banned, is_shadow_banned, family_admin ( onboarding_answers )`).eq('id', familyUserId).single()
        : Promise.resolve({ data: null }),
    ])

    setDrawer({ type: 'match', data: { match, caregiver: caregiverRes.data, family: familyRes.data } })
  }

  const notifIcon = (type: string) => {
    switch (type) {
      case 'new_match': return '🎯'
      case 'caregiver_interested': return '🎉'
      case 'message': return '💬'
      default: return '🔔'
    }
  }

  const matchStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400'
      case 'accepted': return 'bg-green-500/20 text-green-400'
      case 'declined': return 'bg-red-500/20 text-red-400'
      case 'admin_matched': return 'bg-blue-500/20 text-blue-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  const activityFeed = [
    ...users.map(u => ({
      type: 'signup',
      icon: u.role === 'family' ? '👨‍👩‍👧' : '🤝',
      text: `${u.full_name} signed up as ${u.role}`,
      sub: u.email,
      time: u.created_at,
      color: u.role === 'family' ? 'text-blue-400' : 'text-green-400',
      onClick: () => openUserDrawer(u.id),
    })),
    ...notifications.map(n => ({
      type: 'notification',
      icon: notifIcon(n.type),
      text: n.title,
      sub: n.body?.substring(0, 80),
      time: n.created_at,
      color: 'text-purple-400',
      onClick: n.type === 'new_match'
        ? () => {
            if (n.data?.matchId) {
              const match = matches.find(m => m.id === n.data.matchId)
              if (match) { openMatchDrawer(match); return }
            }
            const uid = n.data?.caregiverUserId || n.data?.familyUserId
            if (uid) openUserDrawer(uid)
          }
        : n.data?.caregiverUserId
          ? () => openUserDrawer(n.data.caregiverUserId)
          : n.data?.familyUserId
            ? () => openUserDrawer(n.data.familyUserId)
            : undefined,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 30)

  return (
    <div className="relative">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Operations</h1>
        <p className="text-gray-400 mt-1">Real-time platform activity</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Notifications', value: notifications.length, icon: '🔔' },
          { label: 'New Matches', value: notifications.filter(n => n.type === 'new_match').length, icon: '🎯' },
          { label: 'Caregiver Responses', value: notifications.filter(n => n.type === 'caregiver_interested').length, icon: '🎉' },
          { label: 'Unread', value: notifications.filter(n => !n.read).length, icon: '📬' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <div className="text-xl mb-2">{stat.icon}</div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-6">
        {[
          { id: 'activity', label: '⚡ Live Activity' },
          { id: 'notifications', label: '🔔 Notifications' },
          { id: 'matches', label: '🎯 Matches' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === tab.id ? 'bg-[#7FB3FF] text-white' : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-white'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'activity' && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-white">Activity Feed</h2>
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
              Live
            </span>
          </div>
          <div className="divide-y divide-gray-800">
            {activityFeed.map((item, i) => (
              <div key={i} onClick={item.onClick}
                className={`px-6 py-3 flex items-start gap-3 transition ${item.onClick ? 'cursor-pointer hover:bg-gray-800 group' : 'hover:bg-gray-800/30'}`}>
                <span className="text-xl flex-shrink-0 mt-0.5">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${item.color}`}>{item.text}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{item.sub}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-xs text-gray-600">
                    {new Date(item.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {item.onClick && <span className="text-gray-600 group-hover:text-gray-400 transition text-xs">→</span>}
                </div>
              </div>
            ))}
            {activityFeed.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500 text-sm">No activity yet</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="font-semibold text-white">All Notifications ({notifications.length})</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {notifications.map(n => (
              <div key={n.id} className="px-6 py-4 flex items-start gap-3 hover:bg-gray-800/50 transition">
                <span className="text-xl flex-shrink-0">{notifIcon(n.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white">{n.title}</span>
                    {!n.read && <span className="w-1.5 h-1.5 bg-[#7FB3FF] rounded-full flex-shrink-0" />}
                  </div>
                  <div className="text-xs text-gray-400 line-clamp-2">{n.body}</div>
                  <div className="text-xs text-gray-600 mt-1">Type: <span className="text-gray-500">{n.type}</span></div>
                </div>
                <div className="text-xs text-gray-600 flex-shrink-0">
                  {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            {notifications.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500 text-sm">No notifications yet</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'matches' && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="font-semibold text-white">All Matches ({matches.length})</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {matches.map(m => (
              <div key={m.id} onClick={() => openMatchDrawer(m)}
                className="px-6 py-4 flex items-center gap-4 hover:bg-gray-800 cursor-pointer group transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${matchStatusColor(m.status)}`}>{m.status}</span>
                    <span className="text-xs text-gray-500 truncate">{m.ai_reasoning?.substring(0, 60)}</span>
                  </div>
                  <div className="text-xs text-gray-600">Match ID: {m.id}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-xs text-gray-600">
                    {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <span className="text-gray-600 group-hover:text-gray-400 transition text-xs">→</span>
                </div>
              </div>
            ))}
            {matches.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500 text-sm">No matches yet</div>
            )}
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawer && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setDrawer(null)} />
          <div className="fixed top-0 right-0 h-full w-[420px] bg-gray-950 border-l border-gray-800 z-50 overflow-y-auto">
            <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-5 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-white text-sm">
                {drawer.type === 'loading' && 'Loading...'}
                {drawer.type === 'user' && (drawer.data?.role === 'family' ? '👨‍👩‍👧 Family Profile' : '🤝 Caregiver Profile')}
                {drawer.type === 'match' && '🎯 Match Details'}
              </h2>
              <button onClick={() => setDrawer(null)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="p-5">
              {drawer.type === 'loading' && (
                <div className="flex items-center justify-center h-40">
                  <div className="text-gray-500 text-sm">Loading...</div>
                </div>
              )}
              {drawer.type === 'user' && drawer.data && <UserProfile user={drawer.data} />}
              {drawer.type === 'match' && drawer.data && (
                <MatchDetail match={drawer.data.match} family={drawer.data.family} caregiver={drawer.data.caregiver} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function UserProfile({ user }: { user: any }) {
  const [bioExpanded, setBioExpanded] = useState(false)
  const [answersExpanded, setAnswersExpanded] = useState(false)
  const isCaregiver = user.role === 'caregiver'
  const profile = isCaregiver ? user.caregiver_profiles : user.family_profiles
  const answers = profile?.onboarding_answers || {}
  const answersEntries = Object.entries(answers).filter(([, v]) => v !== null && v !== undefined && v !== '')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {user.avatar_url
          ? <img src={user.avatar_url} className="w-14 h-14 rounded-full object-cover flex-shrink-0" alt="" />
          : <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0 bg-gradient-to-br ${isCaregiver ? 'from-emerald-500 to-teal-600' : 'from-blue-500 to-purple-600'}`}>
              {user.full_name?.[0]?.toUpperCase() || '?'}
            </div>
        }
        <div>
          <div className="text-white font-semibold">{user.full_name}</div>
          <div className="text-gray-400 text-sm">{user.email}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${isCaregiver ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
              {user.role}
            </span>
            {user.is_banned && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">banned</span>}
            {user.is_shadow_banned && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">shadow banned</span>}
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </div>

      {isCaregiver && profile && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-2">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Profile</div>
          {[
            { label: 'Services', value: profile.services?.join(', ') },
            { label: 'Languages', value: profile.languages?.join(', ') },
            { label: 'Experience', value: EXPERIENCE_LABELS[String(profile.years_experience)] },
            { label: 'Rate', value: profile.hourly_rate_min && profile.hourly_rate_max ? `$${profile.hourly_rate_min}–$${profile.hourly_rate_max}/hr` : null },
            { label: 'Availability', value: answers.availability },
            { label: 'Live-in', value: answers.living },
            { label: 'Verified', value: profile.is_verified ? '✓ Yes' : 'No', color: profile.is_verified ? 'text-green-400' : undefined },
            { label: 'Background check', value: profile.background_check_status || 'not run', color: profile.background_check_status === 'clear' ? 'text-green-400' : profile.background_check_status === 'consider' ? 'text-yellow-400' : undefined },
          ].map(({ label, value, color }: any) => value ? (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-gray-500">{label}</span>
              <span className={color || 'text-gray-300'}>{value}</span>
            </div>
          ) : null)}
          {profile.bio && (
            <div className="pt-3 border-t border-gray-700">
              <div className="text-gray-500 text-xs mb-1">Bio</div>
              <div className={`text-gray-300 text-xs leading-relaxed ${bioExpanded ? '' : 'line-clamp-4'}`}>{profile.bio}</div>
              {profile.bio.length > 150 && (
                <button onClick={() => setBioExpanded(p => !p)} className="text-xs text-[#7FB3FF] hover:text-white mt-1 transition">
                  {bioExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!isCaregiver && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-2">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Looking For</div>
          {[
            { label: 'Services', value: answers.services?.join(', ') },
            { label: 'Children ages', value: answers.childcare_ages?.join(', ') },
            { label: 'Children', value: answers.childcare_kids != null ? String(answers.childcare_kids) : null },
            { label: 'Type', value: answers.childcare_type },
            { label: 'Schedule', value: answers.childcare_schedule },
            { label: 'Budget', value: answers.childcare_budget || answers.chef_budget || answers.house_budget },
            { label: 'Start', value: answers.childcare_when },
            { label: 'Extras', value: answers.childcare_extras?.join(', ') },
          ].map(({ label, value }: any) => value ? (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-gray-500">{label}</span>
              <span className="text-gray-300">{value}</span>
            </div>
          ) : null)}
        </div>
      )}

      {answersEntries.length > 0 && (
        <div>
          <button onClick={() => setAnswersExpanded(p => !p)}
            className="text-xs text-gray-500 hover:text-gray-300 transition flex items-center gap-1">
            <span>{answersExpanded ? '▾' : '▸'}</span>
            All onboarding answers ({answersEntries.length})
          </button>
          {answersExpanded && (
            <div className="mt-2 bg-gray-900 rounded-xl border border-gray-800 p-3 space-y-1.5">
              {answersEntries.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 text-xs">
                  <span className="text-gray-600 shrink-0">{k}</span>
                  <span className="text-gray-400 text-right break-all">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MatchDetail({ match, family, caregiver }: { match: any; family: any; caregiver: any }) {
  const matchStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400'
      case 'accepted': return 'bg-green-500/20 text-green-400'
      case 'declined': return 'bg-red-500/20 text-red-400'
      case 'admin_matched': return 'bg-blue-500/20 text-blue-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${matchStatusColor(match.status)}`}>{match.status}</span>
          <span className="text-xs text-gray-500">
            {new Date(match.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        {match.ai_reasoning && (
          <div className="text-xs text-gray-400 leading-relaxed">{match.ai_reasoning}</div>
        )}
      </div>

      <div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">👨‍👩‍👧 Family</div>
        {family ? <UserProfile user={family} /> : <div className="text-xs text-gray-500">No family data</div>}
      </div>

      <div className="border-t border-gray-800 pt-5">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">🤝 Caregiver</div>
        {caregiver ? <UserProfile user={caregiver} /> : <div className="text-xs text-gray-500">No caregiver data</div>}
      </div>
    </div>
  )
}