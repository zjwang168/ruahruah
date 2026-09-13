'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notifyUser } from '@/lib/notifications'

const EXPERIENCE_LABELS: Record<string, string> = {
  '0': 'Less than 1 year',
  '1': '1–2 years',
  '3': '3–5 years',
  '5': '5–10 years',
  '10': '10+ years',
}

export default function AdminMatching() {
  const [matches, setMatches] = useState<any[]>([])
  const [families, setFamilies] = useState<any[]>([])
  const [caregivers, setCaregivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [familySearch, setFamilySearch] = useState('')
  const [caregiverSearch, setCaregiverSearch] = useState('')
  const [selectedFamily, setSelectedFamily] = useState<any>(null)
  const [selectedCaregivers, setSelectedCaregivers] = useState<any[]>([])
  const [manualNote, setManualNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [familyDropdownOpen, setFamilyDropdownOpen] = useState(false)
  const [caregiverDropdownOpen, setCaregiverDropdownOpen] = useState(false)
  const [familyMatchCounts, setFamilyMatchCounts] = useState<Record<string, number>>({})
  const [caregiverMatchCounts, setCaregiverMatchCounts] = useState<Record<string, number>>({})
  const familyRef = useRef<HTMLDivElement>(null)
  const caregiverRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (familyRef.current && !familyRef.current.contains(e.target as Node)) setFamilyDropdownOpen(false)
      if (caregiverRef.current && !caregiverRef.current.contains(e.target as Node)) setCaregiverDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: matchData } = await supabase
        .from('matches')
        .select(`
          *,
          caregiver_profiles ( user_id, services, languages, hourly_rate_min, hourly_rate_max, years_experience, bio ),
          service_requests (
            id, service_type, status, ai_job_post,
            family_admin ( user_id, onboarding_answers, users_admin ( full_name, avatar_url ) )
          )
        `)
        .order('created_at', { ascending: false })

      const { data: familyData } = await supabase
        .from('users_admin')
        .select(`id, full_name, email, avatar_url, created_at, family_admin ( onboarding_answers )`)
        .eq('role', 'family')
        .eq('is_banned', false)
        .eq('is_shadow_banned', false)

      const { data: caregiverData } = await supabase
        .from('users_admin')
        .select(`
          id, full_name, email, avatar_url, created_at,
          caregiver_profiles (
            id, services, languages, hourly_rate_min, hourly_rate_max,
            years_experience, bio, is_verified, background_check_status,
            onboarding_answers, matching_status, last_active_at, match_no_response_count
          )
        `)
        .eq('role', 'caregiver')
        .eq('is_banned', false)
        .eq('is_shadow_banned', false)

      const fCounts: Record<string, number> = {}
      const cCounts: Record<string, number> = {}
      for (const m of matchData || []) {
        const fuid = m.service_requests?.family_profiles?.user_id
        const cuid = m.caregiver_profiles?.user_id
        if (fuid) fCounts[fuid] = (fCounts[fuid] || 0) + 1
        if (cuid) cCounts[cuid] = (cCounts[cuid] || 0) + 1
      }

      setMatches(matchData || [])
      setFamilies(familyData || [])
      setCaregivers(caregiverData || [])
      setFamilyMatchCounts(fCounts)
      setCaregiverMatchCounts(cCounts)
      setLoading(false)
    }
    load()
  }, [])

  const filteredFamilies = families.filter(f => {
    if (!familySearch) return true
    return f.full_name?.toLowerCase().includes(familySearch.toLowerCase()) ||
      f.email?.toLowerCase().includes(familySearch.toLowerCase())
  })

  const filteredCaregivers = caregivers.filter(c => {
    if (!caregiverSearch) return true
    return c.full_name?.toLowerCase().includes(caregiverSearch.toLowerCase()) ||
      c.email?.toLowerCase().includes(caregiverSearch.toLowerCase())
  })

  const toggleCaregiver = (c: any) => {
    setSelectedCaregivers(prev => {
      const exists = prev.find(x => x.id === c.id)
      if (exists) return prev.filter(x => x.id !== c.id)
      return [...prev, c]
    })
  }

  const updateMatchStatus = async (matchId: string, status: string) => {
    await supabase.from('matches').update({ status }).eq('id', matchId)
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status } : m))
  }

  const createManualMatch = async () => {
    if (!selectedFamily || selectedCaregivers.length === 0) return
    setCreating(true)

    const { data: familyProfile } = await supabase
      .from('family_profiles').select('id').eq('user_id', selectedFamily.id).single()

    for (const caregiver of selectedCaregivers) {
      const { data: reqData } = await supabase
        .from('service_requests')
        .insert({
          family_id: familyProfile?.id,
          service_type: 'manual',
          status: 'open',
          ai_job_post: manualNote || 'Manual match created by admin'
        })
        .select().single()

      if (reqData) {
        const { data: caregiverProfile } = await supabase
          .from('caregiver_profiles').select('id').eq('user_id', caregiver.id).single()

        const { data: matchData } = await supabase.from('matches').insert({
          request_id: reqData.id,
          caregiver_id: caregiverProfile?.id,
          status: 'admin_matched',
          ai_reasoning: manualNote || 'Manually matched by admin',
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          family_interested: null,
          caregiver_interested: null,
        }).select().single()

        const matchId = matchData?.id

        // Both notices are cross-user, so both go through /api/notify. The
        // admin allowlist is re-checked server-side there; being on the admin
        // page is not by itself proof of anything.
        await notifyUser({
          recipientUserId: caregiver.id,
          type: 'new_match',
          title: `A family wants to meet you! 🎯`,
          body: manualNote || `The Ruah team thinks you'd be a great fit. Respond within 48 hours!`,
          data: {
            matchId,
            adminMatch: true,
            familyUserId: selectedFamily.id,
            familyName: selectedFamily.full_name,
            requestId: reqData.id,
          }
        })

        await notifyUser({
          recipientUserId: selectedFamily.id,
          type: 'new_match',
          title: `We found a great match for you! 🎯`,
          body: manualNote || `The Ruah team has matched you with ${caregiver.full_name}. Let us know if you're interested within 48 hours!`,
          data: {
            matchId,
            adminMatch: true,
            caregiverUserId: caregiver.id,
            caregiverName: caregiver.full_name,
            requestId: reqData.id,
          }
        })

        // Update caregiver match_no_response_count tracking
        await supabase.from('caregiver_profiles')
          .update({ last_active_at: new Date().toISOString() })
          .eq('user_id', caregiver.id)
      }
    }

    const names = selectedCaregivers.map(c => c.full_name).join(', ')
    setSelectedFamily(null)
    setSelectedCaregivers([])
    setFamilySearch('')
    setCaregiverSearch('')
    setManualNote('')
    setCreating(false)
    alert(`✅ ${selectedCaregivers.length} match${selectedCaregivers.length > 1 ? 'es' : ''} created: ${selectedFamily.full_name} ↔ ${names}`)
  }

  const matchingStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400'
      case 'paused': return 'text-yellow-400'
      case 'inactive': return 'text-red-400'
      default: return 'text-gray-500'
    }
  }

  const matchingStatusLabel = (status: string, noResponseCount: number) => {
    if (status === 'paused') return '🟡 Paused'
    if (status === 'inactive') return '🔴 Inactive'
    if (noResponseCount >= 2) return '🟡 Unresponsive'
    return '🟢 Active'
  }

  const statusColor = (status: string) => {
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Matching System</h1>
        <p className="text-gray-400 mt-1">View all matches and manually create new ones</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total Matches', value: matches.length, icon: '🎯' },
          { label: 'Pending', value: matches.filter(m => m.status === 'admin_matched').length, icon: '⏳' },
          { label: 'Mutual', value: matches.filter(m => m.status === 'accepted').length, icon: '🎉' },
          { label: 'Declined', value: matches.filter(m => m.status === 'declined').length, icon: '✕' },
          { label: 'Active Caregivers', value: caregivers.filter(c => c.caregiver_profiles?.matching_status !== 'inactive').length, icon: '🟢' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <div className="text-xl mb-2">{stat.icon}</div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Create Match */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">
        <h2 className="font-semibold text-white mb-6">👑 Create Manual Match</h2>

        <div className="grid grid-cols-2 gap-6 mb-4">
          {/* Family selector */}
          <div ref={familyRef}>
            <label className="text-xs text-gray-400 mb-2 block">
              Select Family
              <span className="ml-2 text-gray-600">({families.length} total)</span>
            </label>
            {selectedFamily ? (
              <FamilyCard person={selectedFamily} matchCount={familyMatchCounts[selectedFamily.id] || 0} onClear={() => setSelectedFamily(null)} />
            ) : (
              <div className="relative">
                <input
                  value={familySearch}
                  onChange={e => setFamilySearch(e.target.value)}
                  onFocus={() => setFamilyDropdownOpen(true)}
                  placeholder="Search or browse families..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#7FB3FF]"
                />
                {familyDropdownOpen && (
                  <div className="absolute z-20 w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden">
                    <div className="max-h-56 overflow-y-auto divide-y divide-gray-700/50">
                      {filteredFamilies.length === 0
                        ? <div className="px-4 py-3 text-sm text-gray-500 text-center">No families found</div>
                        : filteredFamilies.map(f => (
                          <button key={f.id} onClick={() => { setSelectedFamily(f); setFamilySearch(''); setFamilyDropdownOpen(false) }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700 transition text-left">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                              {f.full_name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-white truncate">{f.full_name}</div>
                              <div className="text-xs text-gray-400 truncate">{f.email}</div>
                            </div>
                            {familyMatchCounts[f.id] > 0 && (
                              <span className="text-xs text-blue-400 flex-shrink-0">{familyMatchCounts[f.id]} matches</span>
                            )}
                          </button>
                        ))
                      }
                    </div>
                    <div className="px-3 py-2 border-t border-gray-700 bg-gray-800/80">
                      <span className="text-xs text-gray-500">{filteredFamilies.length} of {families.length} families</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Caregiver multi-select */}
          <div ref={caregiverRef}>
            <label className="text-xs text-gray-400 mb-2 block">
              Select Caregivers
              <span className="ml-2 text-gray-600">({caregivers.length} total)</span>
              {selectedCaregivers.length > 0 && (
                <span className="ml-2 text-[#7FB3FF]">{selectedCaregivers.length} selected</span>
              )}
            </label>

            {selectedCaregivers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedCaregivers.map(c => (
                  <div key={c.id} className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-2.5 py-1">
                    <span className="text-xs text-emerald-300">{c.full_name}</span>
                    <button onClick={() => toggleCaregiver(c)} className="text-emerald-500 hover:text-white text-sm leading-none">×</button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              <input
                value={caregiverSearch}
                onChange={e => setCaregiverSearch(e.target.value)}
                onFocus={() => setCaregiverDropdownOpen(true)}
                placeholder={selectedCaregivers.length > 0 ? "Add another caregiver..." : "Search or browse caregivers..."}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#7FB3FF]"
              />
              {caregiverDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden">
                  <div className="max-h-56 overflow-y-auto divide-y divide-gray-700/50">
                    {filteredCaregivers.length === 0
                      ? <div className="px-4 py-3 text-sm text-gray-500 text-center">No caregivers found</div>
                      : filteredCaregivers.map(c => {
                          const isSelected = selectedCaregivers.some(x => x.id === c.id)
                          const cp = c.caregiver_profiles
                          const status = cp?.matching_status || 'active'
                          const noResp = cp?.match_no_response_count || 0
                          return (
                            <button key={c.id} onClick={() => { toggleCaregiver(c); setCaregiverSearch('') }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 transition text-left ${isSelected ? 'bg-emerald-500/10' : 'hover:bg-gray-700'}`}>
                              {c.avatar_url
                                ? <img src={c.avatar_url} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />
                                : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                    {c.full_name?.[0]?.toUpperCase() || '?'}
                                  </div>
                              }
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-white truncate">{c.full_name}</span>
                                  {cp?.is_verified && <span className="text-xs text-green-400 flex-shrink-0">✓</span>}
                                  <span className={`text-xs flex-shrink-0 ${matchingStatusColor(status)}`}>
                                    {matchingStatusLabel(status, noResp)}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-400 truncate">
                                  {c.email}
                                  {cp?.services?.length > 0 && (
                                    <span className="ml-1.5 text-gray-500">· {cp.services.join(', ')}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {caregiverMatchCounts[c.id] > 0 && (
                                  <span className="text-xs text-emerald-400">{caregiverMatchCounts[c.id]} matches</span>
                                )}
                                {isSelected && <span className="text-emerald-400 text-sm">✓</span>}
                              </div>
                            </button>
                          )
                        })
                    }
                  </div>
                  <div className="px-3 py-2 border-t border-gray-700 bg-gray-800/80">
                    <span className="text-xs text-gray-500">{filteredCaregivers.length} of {caregivers.length} caregivers</span>
                  </div>
                </div>
              )}
            </div>

            {selectedCaregivers.length > 0 && (
              <div className="mt-3 space-y-3">
                {selectedCaregivers.map(c => (
                  <CaregiverCard key={c.id} person={c} matchCount={caregiverMatchCounts[c.id] || 0} onClear={() => toggleCaregiver(c)} />
                ))}
              </div>
            )}
          </div>
        </div>

        <textarea
          value={manualNote}
          onChange={e => setManualNote(e.target.value)}
          placeholder="Note for this match (optional — sent to both parties)..."
          rows={2}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#7FB3FF] resize-none mb-4"
        />
        <button
          onClick={createManualMatch}
          disabled={!selectedFamily || selectedCaregivers.length === 0 || creating}
          className="px-6 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40 transition"
          style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
          {creating
            ? 'Creating...'
            : selectedCaregivers.length > 1
              ? `✨ Create ${selectedCaregivers.length} Matches & Notify All Parties`
              : '✨ Create Match & Notify Both Parties'}
        </button>
      </div>

      {/* Matches List */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">All Matches ({matches.length})</h2>
        </div>
        <div className="divide-y divide-gray-800">
          {matches.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">No matches yet</div>
          )}
          {matches.map(m => {
            const family = m.service_requests?.family_profiles
            const familyInterested = m.family_interested
            const caregiverInterested = m.caregiver_interested
            const isMutual = m.status === 'accepted'

            return (
              <div key={m.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-800/50 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm text-white font-medium">{family?.users_admin?.full_name || 'Unknown Family'}</span>
                    <span className="text-gray-500">↔</span>
                    <span className="text-sm text-[#7FB3FF] font-medium">Caregiver</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(m.status)}`}>{m.status}</span>
                    {isMutual && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">🎉 Mutual</span>}
                  </div>
                  {/* Interest status */}
                  <div className="flex gap-3 text-xs mt-1">
                    <span className={familyInterested === true ? 'text-green-400' : familyInterested === false ? 'text-red-400' : 'text-gray-500'}>
                      Family: {familyInterested === true ? '✓ Interested' : familyInterested === false ? '✕ Passed' : '⏳ Pending'}
                    </span>
                    <span className={caregiverInterested === true ? 'text-green-400' : caregiverInterested === false ? 'text-red-400' : 'text-gray-500'}>
                      Caregiver: {caregiverInterested === true ? '✓ Interested' : caregiverInterested === false ? '✕ Passed' : '⏳ Pending'}
                    </span>
                    {m.expires_at && !isMutual && (
                      <span className="text-gray-600">
                        Expires {new Date(m.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.status !== 'accepted' && (
                    <button onClick={() => updateMatchStatus(m.id, 'accepted')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition">
                      ✅ Force Approve
                    </button>
                  )}
                  {m.status !== 'declined' && (
                    <button onClick={() => updateMatchStatus(m.id, 'declined')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition">
                      ✕ Decline
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function FamilyCard({ person, matchCount, onClear }: { person: any; matchCount: number; onClear: () => void }) {
  const [answersExpanded, setAnswersExpanded] = useState(false)
  const answers = person.family_profiles?.onboarding_answers || {}
  const joinedDate = person.created_at
    ? new Date(person.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null
  const answersEntries = Object.entries(answers).filter(([, v]) => v !== null && v !== undefined && v !== '')

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 relative">
      <button onClick={onClear} className="absolute top-3 right-3 text-gray-500 hover:text-white text-lg leading-none">×</button>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white flex-shrink-0">
          {person.full_name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="min-w-0">
          <div className="text-white font-medium text-sm">{person.full_name}</div>
          <div className="text-gray-400 text-xs truncate">{person.email}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-700">
        {joinedDate && <span className="text-xs text-gray-500">Joined {joinedDate}</span>}
        <span className={`text-xs px-2 py-0.5 rounded-full ${matchCount > 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-500'}`}>
          {matchCount} {matchCount === 1 ? 'match' : 'matches'}
        </span>
      </div>
      <div className="space-y-1.5 text-xs">
        {[
          { label: 'Services', value: answers.services?.join(', ') },
          { label: 'Children ages', value: answers.childcare_ages?.join(', ') },
          { label: 'Children', value: answers.childcare_kids != null ? String(answers.childcare_kids) : null },
          { label: 'Type', value: answers.childcare_type },
          { label: 'Schedule', value: answers.childcare_schedule },
          { label: 'Budget', value: answers.childcare_budget || answers.chef_budget || answers.house_budget },
          { label: 'Start', value: answers.childcare_when },
          { label: 'Extras', value: answers.childcare_extras?.join(', ') },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between">
            <span className="text-gray-500">{label}</span>
            <span className="text-gray-300">{value || '—'}</span>
          </div>
        ))}
        {answersEntries.length > 0 && (
          <div className="pt-2 border-t border-gray-700">
            <button onClick={() => setAnswersExpanded(p => !p)}
              className="text-xs text-gray-500 hover:text-gray-300 transition flex items-center gap-1">
              <span>{answersExpanded ? '▾' : '▸'}</span>
              <span>All answers ({answersEntries.length})</span>
            </button>
            {answersExpanded && (
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto pr-1">
                {answersEntries.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-gray-600 shrink-0">{k}</span>
                    <span className="text-gray-400 text-right break-all">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CaregiverCard({ person, matchCount, onClear }: { person: any; matchCount: number; onClear: () => void }) {
  const [bioExpanded, setBioExpanded] = useState(false)
  const answers = person.caregiver_profiles?.onboarding_answers || {}
  const profile = person.caregiver_profiles
  const joinedDate = person.created_at
    ? new Date(person.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const bgCheckColor = (status: string) => {
    switch (status) {
      case 'clear': return 'text-green-400'
      case 'consider': return 'text-yellow-400'
      case 'suspended': case 'dispute': return 'text-red-400'
      default: return 'text-gray-500'
    }
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 relative">
      <button onClick={onClear} className="absolute top-3 right-3 text-gray-500 hover:text-white text-lg leading-none">×</button>
      <div className="flex items-center gap-3 mb-3">
        {person.avatar_url
          ? <img src={person.avatar_url} className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />
          : <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-bold text-white flex-shrink-0">
              {person.full_name?.[0]?.toUpperCase() || '?'}
            </div>
        }
        <div className="min-w-0">
          <div className="text-white font-medium text-sm">{person.full_name}</div>
          <div className="text-gray-400 text-xs truncate">{person.email}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-700">
        {joinedDate && <span className="text-xs text-gray-500">Joined {joinedDate}</span>}
        <span className={`text-xs px-2 py-0.5 rounded-full ${matchCount > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-500'}`}>
          {matchCount} {matchCount === 1 ? 'match' : 'matches'}
        </span>
        {profile?.matching_status && (
          <span className={`text-xs ${profile.matching_status === 'active' ? 'text-green-400' : profile.matching_status === 'paused' ? 'text-yellow-400' : 'text-red-400'}`}>
            {profile.matching_status === 'active' ? '🟢 Active' : profile.matching_status === 'paused' ? '🟡 Paused' : '🔴 Inactive'}
          </span>
        )}
      </div>
      {profile && (
        <div className="space-y-1.5 text-xs">
          {[
            { label: 'Services', value: profile.services?.join(', ') },
            { label: 'Languages', value: profile.languages?.join(', ') },
            { label: 'Experience', value: EXPERIENCE_LABELS[String(profile.years_experience)] },
            { label: 'Rate', value: profile.hourly_rate_min && profile.hourly_rate_max ? `$${profile.hourly_rate_min}–$${profile.hourly_rate_max}/hr` : null },
            { label: 'Availability', value: answers.availability },
            { label: 'Live-in', value: answers.living },
            { label: 'No-response count', value: profile.match_no_response_count > 0 ? `${profile.match_no_response_count} times` : null },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between">
              <span className="text-gray-500">{label}</span>
              <span className={`text-gray-300 ${label === 'No-response count' && profile.match_no_response_count >= 2 ? 'text-yellow-400' : ''}`}>
                {value || '—'}
              </span>
            </div>
          ))}
          <div className="flex justify-between">
            <span className="text-gray-500">Verified</span>
            <span className={profile.is_verified ? 'text-green-400' : 'text-gray-500'}>{profile.is_verified ? '✓ Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Background check</span>
            <span className={bgCheckColor(profile.background_check_status)}>{profile.background_check_status || 'not run'}</span>
          </div>
          {profile.bio && (
            <div className="pt-1.5 border-t border-gray-700">
              <div className="text-gray-500 mb-1">Bio</div>
              <div className={`text-gray-300 leading-relaxed ${bioExpanded ? '' : 'line-clamp-3'}`}>{profile.bio}</div>
              {profile.bio.length > 120 && (
                <button onClick={() => setBioExpanded(p => !p)} className="text-xs text-[#7FB3FF] hover:text-white mt-1 transition">
                  {bioExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}