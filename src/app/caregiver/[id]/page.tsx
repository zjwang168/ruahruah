'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

const EXPERIENCE_LABELS: Record<string, string> = {
  '0': 'Less than 1 year',
  '1': '1–2 years',
  '3': '3–5 years',
  '5': '5–10 years',
  '10': '10+ years',
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export default function CaregiverPublicProfile() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [profileUser, setProfileUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [viewerRole, setViewerRole] = useState<string | null>(null)

  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const userId = params.id as string

      // Get current logged in user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: currentUserData } = await supabase
          .from('users').select('id, role').eq('id', authUser.id).single()
        setCurrentUser(currentUserData)
        setViewerRole(currentUserData?.role)
        setIsOwnProfile(authUser.id === userId)
      }

      // ONE query answers both "does this page exist" and "who is it".
      //
      // There used to be a separate read of `users` here for the name and the
      // ban flags. It cannot stay: this page is reachable logged out, and
      // 20260913000100 withholds full_name from anon and authenticated alike.
      // caregiver_public already excludes banned and shadow-banned caregivers
      // in its WHERE clause, so "no row" IS the 404 — and its nested `users`
      // object carries the display identity, abbreviated in Postgres.
      const { data: profileData } = await supabase
        .from('caregiver_public')
        .select('id, user_id, bio, years_experience, languages, services, hourly_rate_min, hourly_rate_max, is_verified, rating, review_count, availability_type, overnight_ok, users')
        .eq('user_id', userId).single()

      if (!profileData) {
        router.push('/not-found')
        return
      }

      setProfileUser(profileData.users)
      setProfile(profileData)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  if (!profileUser || !profile) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Profile not found</div>
    </div>
  )

  const answers = profile?.onboarding_answers || {}
  const availabilitySchedule = profile?.availability_schedule || {}
  const sortedDays = DAY_ORDER.filter(d => availabilitySchedule[d])

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex items-center gap-2">
          <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8" />
          <span className="text-lg font-bold text-[#7FB3FF]">Ruah!</span>
        </div>
        {isOwnProfile ? (
          <button onClick={() => router.push('/caregiver/profile')}
            className="text-sm text-[#7FB3FF] hover:underline">Edit</button>
        ) : (
          <div className="w-12" />
        )}
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* Profile Header */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0">
              {profileUser.avatar_url ? (
                <img src={profileUser.avatar_url} alt={profileUser.display_name}
                  className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-3xl font-bold text-white">
                  {profileUser.display_name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="text-xl font-bold text-gray-900">{profileUser.display_name}</h1>
                {profile.is_verified && (
                  <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">✓ Verified</span>
                )}
              </div>

              {/* Location */}
              {profileUser.city && profileUser.state && (
                <div className="text-sm text-gray-400 mb-2">📍 {profileUser.city}, {profileUser.state}</div>
              )}

              {/* Languages */}
              <div className="flex flex-wrap gap-1 mb-2">
                {profile.languages?.map((lang: string) => (
                  <span key={lang} className="text-xs bg-[#EAF4FF] text-[#4A90D9] px-2 py-0.5 rounded-full">{lang}</span>
                ))}
              </div>

              {/* Key stats */}
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                {profile.years_experience != null && (
                  <span>⭐ {EXPERIENCE_LABELS[String(profile.years_experience)] || `${profile.years_experience}+ yrs`}</span>
                )}
                {profile.hourly_rate_min && (
                  <span>💰 ${profile.hourly_rate_min}{profile.hourly_rate_max ? `–$${profile.hourly_rate_max}` : '+'}/hr</span>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600 leading-relaxed">{profile.bio}</p>
            </div>
          )}

          {/* Action buttons */}
          {!isOwnProfile && (
            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
              {viewerRole === 'family' && (
                <button
                  onClick={() => router.push(`/messages/${profileUser.id}`)}
                  className="flex-1 text-white py-3 rounded-xl text-sm font-semibold transition"
                  style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                  💬 Send Message
                </button>
              )}
              {viewerRole === 'family' && (
                <button
                  onClick={() => router.push(`/family/chat?caregiver=${profileUser.id}&name=${encodeURIComponent(profileUser.display_name || 'this caregiver')}`)}
                  className="flex-1 py-3 rounded-xl text-sm font-medium border-2 border-[#7FB3FF] text-[#7FB3FF] hover:bg-blue-50 transition">
                  ✨ Ask Ruah About This Caregiver
                </button>
              )}
            </div>
          )}

          {isOwnProfile && (
            <button
              onClick={() => router.push('/caregiver/profile')}
              className="w-full mt-4 pt-4 border-t border-gray-100 text-[#7FB3FF] text-sm font-medium hover:underline">
              ✏️ Edit your profile →
            </button>
          )}
        </div>

        {/* Services */}
        {profile.services?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">Services Offered</h2>
            <div className="flex flex-wrap gap-2">
              {profile.services.map((svc: string) => (
                <span key={svc} className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full capitalize">{svc}</span>
              ))}
            </div>
          </div>
        )}

        {/* Details */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <h2 className="font-semibold text-gray-900 mb-4">Details</h2>
          <div className="space-y-3">
            {[
              { label: 'Experience', value: EXPERIENCE_LABELS[String(profile.years_experience)] || `${profile.years_experience} years` },
              { label: 'Hourly Rate', value: profile.hourly_rate_min ? `$${profile.hourly_rate_min}${profile.hourly_rate_max ? `–$${profile.hourly_rate_max}` : '+'}/hr` : null },
              { label: 'Availability type', value: profile.availability_type?.join(', ') },
              { label: 'Live-in', value: answers.living === 'yes' ? 'Open to live-in' : answers.living === 'no' ? 'Live-out only' : answers.living === 'open' ? 'Open to discuss' : null },
              { label: 'Overnight', value: profile.overnight_ok ? 'Open to overnight' : null },
            ].filter(item => item.value).map(item => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-gray-400">{item.label}</span>
                <span className="text-gray-900 font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Availability Schedule */}
        {sortedDays.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
            <h2 className="font-semibold text-gray-900 mb-4">Weekly Availability</h2>
            <div className="space-y-2">
              {sortedDays.map(day => {
                const times = availabilitySchedule[day]
                return (
                  <div key={day} className="flex justify-between text-sm">
                    <span className="text-gray-600 capitalize">{day}</span>
                    <span className="text-gray-500">{formatTime(times.start)} – {formatTime(times.end)}</span>
                  </div>
                )
              })}
            </div>
            {profile.overnight_ok && (
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-purple-500">
                🌙 Also open to overnight work
              </div>
            )}
          </div>
        )}

        {/* What verification does and does not cover. Shown to families here,
            at the moment they are deciding, rather than buried in a policy. */}
        {!isOwnProfile && viewerRole === 'family' && (
          <div className="bg-[#FAFCFF] border border-gray-100 rounded-2xl p-4 mb-4">
            <div className="font-semibold text-gray-900 text-sm mb-1">
              {profile.is_verified ? 'What “verified” means here' : 'Before you hire'}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-2">
              {profile.is_verified
                ? 'We checked this caregiver’s government ID and selfie by hand, so we believe they are who they say they are. That is not a background check — Ruah does not run them.'
                : 'This caregiver has not completed identity verification, and Ruah does not run background checks on anyone.'}
            </p>
            <Link href="/trust" className="text-xs text-[#4A90D9] font-medium hover:underline">
              How to arrange your own background check →
            </Link>
          </div>
        )}

        {/* Bottom CTA for family */}
        {!isOwnProfile && viewerRole === 'family' && (
          <button
            onClick={() => router.push(`/messages/${profileUser.id}`)}
            className="w-full py-4 rounded-2xl text-white font-semibold text-sm transition"
            style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
            💬 Message {profileUser.display_name?.split(' ')[0]}
          </button>
        )}
      </div>
    </div>
  )
}