'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AdminModeration() {
  const [caregivers, setCaregivers] = useState<any[]>([])
  const [families, setFamilies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'bios' | 'reports' | 'flagged'>('bios')
  const supabase = createClient()

  // Flagged keywords to auto-detect
  const FLAGGED_KEYWORDS = [
    'cash only', 'no background', 'off the books', 'no taxes',
    'wire transfer', 'western union', 'gift card', 'venmo only',
    'whatsapp me', 'contact outside', 'bypass', 'illegal',
  ]

  useEffect(() => {
    const load = async () => {
      const { data: caregiverData } = await supabase
        .from('users_admin')
        .select(`
          *,
          caregiver_profiles (
            bio, services, languages,
            hourly_rate_min, hourly_rate_max,
            is_verified, background_check_status
          )
        `)
        .eq('role', 'caregiver')
        .order('created_at', { ascending: false })

      const { data: familyData } = await supabase
        .from('users_admin')
        .select(`
          *,
          family_admin ( onboarding_answers )
        `)
        .eq('role', 'family')
        .order('created_at', { ascending: false })

      setCaregivers(caregiverData || [])
      setFamilies(familyData || [])
      setLoading(false)
    }
    load()
  }, [])

  const isFlagged = (text: string) => {
    if (!text) return false
    const lower = text.toLowerCase()
    return FLAGGED_KEYWORDS.some(kw => lower.includes(kw))
  }

  const flaggedCaregivers = caregivers.filter(c =>
    isFlagged(c.caregiver_profiles?.bio)
  )

  const unverifiedWithBio = caregivers.filter(c =>
    c.caregiver_profiles?.bio &&
    !c.caregiver_profiles?.is_verified &&
    !c.is_banned &&
    !c.is_shadow_banned
  )

  const shadowBanUser = async (userId: string, reason: string) => {
    await supabase.from('users').update({
      is_shadow_banned: true,
      ban_reason: reason
    }).eq('id', userId)
    setCaregivers(prev => prev.map(c =>
      c.id === userId ? { ...c, is_shadow_banned: true, ban_reason: reason } : c
    ))
  }

  const hardBanUser = async (userId: string, reason: string) => {
    await supabase.from('users').update({
      is_banned: true,
      ban_reason: reason
    }).eq('id', userId)
    setCaregivers(prev => prev.map(c =>
      c.id === userId ? { ...c, is_banned: true, ban_reason: reason } : c
    ))
  }

  const verifyCaregiver = async (userId: string) => {
    await supabase.from('caregiver_profiles')
      .update({ is_verified: true })
      .eq('user_id', userId)
    setCaregivers(prev => prev.map(c =>
      c.id === userId ? {
        ...c,
        caregiver_profiles: { ...c.caregiver_profiles, is_verified: true }
      } : c
    ))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Moderation</h1>
        <p className="text-gray-400 mt-1">Review content and keep the platform safe</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Flagged Bios', value: flaggedCaregivers.length, icon: '🚨', color: 'text-red-400' },
          { label: 'Pending Verification', value: unverifiedWithBio.length, icon: '⏳', color: 'text-yellow-400' },
          { label: 'Verified Caregivers', value: caregivers.filter(c => c.caregiver_profiles?.is_verified).length, icon: '✅', color: 'text-green-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <div className="text-xl mb-2">{stat.icon}</div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'flagged', label: '🚨 Flagged Content', count: flaggedCaregivers.length },
          { id: 'bios', label: '📝 Pending Review', count: unverifiedWithBio.length },
          { id: 'reports', label: '📋 All Caregivers', count: caregivers.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-[#7FB3FF] text-white'
                : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-gray-700'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Flagged Content */}
      {activeTab === 'flagged' && (
        <div className="space-y-4">
          {flaggedCaregivers.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-gray-400">No flagged content detected</div>
            </div>
          ) : flaggedCaregivers.map(c => {
            const bio = c.caregiver_profiles?.bio || ''
            const flaggedWords = FLAGGED_KEYWORDS.filter(kw =>
              bio.toLowerCase().includes(kw)
            )
            return (
              <div key={c.id} className="bg-gray-900 rounded-2xl border border-red-500/30 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
                        {c.full_name?.[0] || '?'}
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-white">{c.full_name}</div>
                      <div className="text-xs text-gray-400">{c.email}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-lg">
                      🚨 {flaggedWords.length} flag{flaggedWords.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Flagged keywords */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {flaggedWords.map(kw => (
                    <span key={kw} className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
                      "{kw}"
                    </span>
                  ))}
                </div>

                {/* Bio */}
                <div className="bg-gray-800 rounded-xl p-3 mb-3 text-sm text-gray-300 leading-relaxed">
                  {bio}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => shadowBanUser(c.id, `Flagged bio content: ${flaggedWords.join(', ')}`)}
                    disabled={c.is_shadow_banned}
                    className="flex-1 py-2 rounded-xl text-xs font-medium bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-40 transition"
                  >
                    👻 Shadow Ban
                  </button>
                  <button
                    onClick={() => hardBanUser(c.id, `Flagged bio content: ${flaggedWords.join(', ')}`)}
                    disabled={c.is_banned}
                    className="flex-1 py-2 rounded-xl text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 transition"
                  >
                    🚫 Hard Ban
                  </button>
                  <button
                    onClick={() => verifyCaregiver(c.id)}
                    disabled={c.caregiver_profiles?.is_verified}
                    className="flex-1 py-2 rounded-xl text-xs font-medium bg-green-500 text-white hover:bg-green-600 disabled:opacity-40 transition"
                  >
                    ✅ Approve
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pending Review */}
      {activeTab === 'bios' && (
        <div className="space-y-4">
          {unverifiedWithBio.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-gray-400">No bios pending review</div>
            </div>
          ) : unverifiedWithBio.map(c => (
            <div key={c.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
                      {c.full_name?.[0] || '?'}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-white">{c.full_name}</div>
                    <div className="text-xs text-gray-400">{c.email}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {c.caregiver_profiles?.services?.join(', ')} · {c.caregiver_profiles?.languages?.join(', ')}
                    </div>
                  </div>
                </div>
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-lg">
                  Pending Review
                </span>
              </div>

              {/* Bio */}
              <div className="bg-gray-800 rounded-xl p-3 mb-3 text-sm text-gray-300 leading-relaxed">
                {c.caregiver_profiles?.bio}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => verifyCaregiver(c.id)}
                  className="flex-1 py-2 rounded-xl text-xs font-medium bg-green-500 text-white hover:bg-green-600 transition"
                >
                  ✅ Verify & Approve
                </button>
                <button
                  onClick={() => shadowBanUser(c.id, 'Bio content not appropriate')}
                  className="flex-1 py-2 rounded-xl text-xs font-medium bg-yellow-600 text-white hover:bg-yellow-700 transition"
                >
                  👻 Shadow Ban
                </button>
                <button
                  onClick={() => hardBanUser(c.id, 'Bio content violates terms')}
                  className="flex-1 py-2 rounded-xl text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition"
                >
                  🚫 Hard Ban
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All Caregivers */}
      {activeTab === 'reports' && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="divide-y divide-gray-800">
            {caregivers.map(c => (
              <div key={c.id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-shrink-0">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                      {c.full_name?.[0] || '?'}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white">{c.full_name}</span>
                    {c.caregiver_profiles?.is_verified && (
                      <span className="text-xs text-green-400">✓</span>
                    )}
                    {c.is_banned && <span className="text-xs text-red-400">🚫</span>}
                    {c.is_shadow_banned && <span className="text-xs text-yellow-400">👻</span>}
                    {isFlagged(c.caregiver_profiles?.bio) && (
                      <span className="text-xs text-red-400">🚨</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{c.email}</div>
                </div>
                <div className="text-xs text-gray-500">
                  {c.caregiver_profiles?.bio ? '📝 Has bio' : '❌ No bio'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}