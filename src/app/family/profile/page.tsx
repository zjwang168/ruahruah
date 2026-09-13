'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

function QuickRepliesCard({ profileId, initialReplies }: { profileId: string; initialReplies: Record<string, string> }) {
  const supabase = createClient()
  const [replies, setReplies] = useState<Record<string, string>>(initialReplies)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const FAQ_FIELDS = [
    { key: 'num_children', label: 'How many children?', placeholder: 'e.g. 2 children, ages 3 and 5' },
    { key: 'schedule', label: 'What is the schedule?', placeholder: 'e.g. Mon–Fri, 8am–6pm' },
    { key: 'location', label: 'Where are you located?', placeholder: 'e.g. Northwest DC, near Tenleytown' },
    { key: 'live_in', label: 'Live-in or commute?', placeholder: 'e.g. Commute only' },
    { key: 'driving', label: 'Is driving required?', placeholder: 'e.g. Yes, must have a valid license' },
    { key: 'languages', label: 'Language preference?', placeholder: 'e.g. Mandarin preferred but not required' },
    { key: 'start_date', label: 'When do you need to start?', placeholder: 'e.g. ASAP or June 1st' },
  ]

  const save = async () => {
    if (!profileId) return
    setSaving(true)
    await supabase.from('family_profiles').update({ auto_replies: replies }).eq('id', profileId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
      <h2 className="font-semibold text-gray-900 mb-1">Quick Replies</h2>
      <p className="text-sm text-gray-400 mb-4">
        Set answers to common questions. Ruah AI will use these to automatically reply to caregivers on your behalf.
      </p>
      <div className="space-y-3">
        {FAQ_FIELDS.map(field => (
          <div key={field.key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
            <input
              type="text"
              value={replies[field.key] || ''}
              onChange={e => setReplies(prev => ({ ...prev, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]"
            />
          </div>
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition"
        style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
        {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Quick Replies'}
      </button>
    </div>
  )
}

export default function FamilyProfile() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [fullName, setFullName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [savedName, setSavedName] = useState(false)

  const [zipcode, setZipcode] = useState('')
  const [zipcodeInfo, setZipcodeInfo] = useState<{ city: string; state: string } | null>(null)
  const [zipcodeLoading, setZipcodeLoading] = useState(false)
  const [zipcodeError, setZipcodeError] = useState('')
  const [savingLocation, setSavingLocation] = useState(false)
  const [savedLocation, setSavedLocation] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }
      const { data: userData } = await supabase.from('user_self').select('*').single()
      const { data: profileData } = await supabase.from('family_self').select('*').single()
      setUser(userData)
      setProfile(profileData)
      setFullName(userData?.full_name || '')
      setAvatarUrl(userData?.avatar_url || null)
      setZipcode(userData?.zipcode || '')
      if (userData?.city && userData?.state) {
        setZipcodeInfo({ city: userData.city, state: userData.state })
      }
      setLoading(false)
    }
    load()
  }, [])

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('users').update({ avatar_url: data.publicUrl }).eq('id', user.id)
      setAvatarUrl(data.publicUrl)
    }
    setUploadingAvatar(false)
  }

  const removeAvatar = async () => {
    await supabase.from('users').update({ avatar_url: null }).eq('id', user.id)
    setAvatarUrl(null)
  }

  const saveName = async () => {
    if (!fullName.trim()) return
    setSavingName(true)
    await supabase.from('users').update({ full_name: fullName.trim() }).eq('id', user.id)
    setUser((prev: any) => ({ ...prev, full_name: fullName.trim() }))
    setSavingName(false)
    setSavedName(true)
    setEditingName(false)
    setTimeout(() => setSavedName(false), 2000)
  }

  const lookupZipcode = async (zip: string) => {
    if (zip.length !== 5) { setZipcodeInfo(null); setZipcodeError(''); return }
    setZipcodeLoading(true)
    setZipcodeError('')
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
      if (!res.ok) { setZipcodeError('Invalid ZIP code'); setZipcodeInfo(null) }
      else {
        const data = await res.json()
        const place = data.places?.[0]
        if (place) setZipcodeInfo({ city: place['place name'], state: place['state abbreviation'] })
      }
    } catch { setZipcodeError('Could not verify') }
    finally { setZipcodeLoading(false) }
  }

  const handleZipcodeChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 5)
    setZipcode(cleaned)
    lookupZipcode(cleaned)
  }

  const saveLocation = async () => {
    if (!zipcodeInfo) return
    setSavingLocation(true)
    await supabase.from('users').update({
      zipcode,
      city: zipcodeInfo.city,
      state: zipcodeInfo.state,
    }).eq('id', user.id)
    setSavingLocation(false)
    setSavedLocation(true)
    setTimeout(() => setSavedLocation(false), 2000)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  const answers = profile?.onboarding_answers || {}

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.push('/family/dashboard')}
          className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex items-center gap-2">
          <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8" />
          <span className="text-lg font-bold text-[#7FB3FF]">Ruah!</span>
        </div>
        <div className="w-12" />
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

        {/* Avatar + Name */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4 flex items-center gap-4">
          <div className="relative flex-shrink-0 group">
            <label className="cursor-pointer block">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7FB3FF] to-[#A78BFA] flex items-center justify-center text-3xl font-bold text-white">
                  {user?.full_name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <span className="text-white text-xl">📷</span>
              </div>
              {uploadingAvatar && (
                <div className="absolute inset-0 rounded-full bg-white/70 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-[#7FB3FF] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
            </label>
          </div>

          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex gap-2 mb-1">
                <input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName() }}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]"
                  autoFocus
                />
                <button onClick={saveName} disabled={savingName}
                  className="px-3 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                  {savingName ? '...' : 'Save'}
                </button>
                <button onClick={() => { setEditingName(false); setFullName(user?.full_name || '') }}
                  className="px-3 py-2 rounded-xl text-sm border border-gray-200 text-gray-500">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900">{user?.full_name}</span>
                <button onClick={() => setEditingName(true)}
                  className="text-xs text-[#7FB3FF] hover:underline">Edit</button>
                {savedName && <span className="text-xs text-green-500">✓ Saved</span>}
              </div>
            )}
            <p className="text-sm text-gray-400">{user?.email}</p>
            <div className="mt-2 flex gap-3">
              <label className="cursor-pointer text-xs text-[#7FB3FF] hover:underline">
                {avatarUrl ? 'Change photo' : '+ Upload photo'}
                <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
              </label>
              {avatarUrl && (
                <button onClick={removeAvatar} className="text-xs text-red-400 hover:text-red-600">
                  Remove photo
                </button>
              )}
            </div>
            <p className="text-xs text-gray-300 mt-0.5">JPG, PNG · Max 5MB</p>
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <h2 className="font-semibold text-gray-900 mb-4">Basic Info</h2>
          <div className="space-y-3">
            {[
              { label: 'Name', value: user?.full_name },
              { label: 'Email', value: user?.email },
              { label: 'Looking for', value: answers.services?.join(', ') },
              { label: 'Children ages', value: answers.childcare_ages?.join(', ') },
              { label: 'Schedule', value: answers.childcare_schedule },
              { label: 'Budget', value: answers.childcare_budget || answers.chef_budget || answers.pet_budget },
              { label: 'Start date', value: answers.childcare_when },
            ].map(item => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-gray-400">{item.label}</span>
                <span className="text-gray-900 font-medium">{item.value || '—'}</span>
              </div>
            ))}
          </div>

          {/* Location */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">📍 Location</span>
              {zipcodeInfo && (
                <span className="text-xs text-gray-400">{zipcodeInfo.city}, {zipcodeInfo.state}</span>
              )}
            </div>
            {!zipcode && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mb-2">
                ⚠️ Add your ZIP code so caregivers near you can find your request
              </p>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={zipcode}
                  onChange={e => handleZipcodeChange(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF] ${
                    zipcodeError ? 'border-red-300' : zipcodeInfo ? 'border-green-300' : 'border-gray-200'
                  }`}
                  placeholder="ZIP code (e.g. 10001)"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">
                  {zipcodeLoading && <span className="text-gray-400">...</span>}
                  {!zipcodeLoading && zipcodeInfo && <span className="text-green-500">✓</span>}
                  {!zipcodeLoading && zipcodeError && <span className="text-red-400">✕</span>}
                </div>
              </div>
              <button onClick={saveLocation}
                disabled={!zipcodeInfo || savingLocation || zipcodeLoading}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40 transition flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                {savedLocation ? '✓ Saved' : savingLocation ? '...' : 'Save'}
              </button>
            </div>
            {zipcodeError && <p className="text-xs text-red-400 mt-1">{zipcodeError}</p>}
          </div>
        </div>

        {/* Special Requirements */}
        {answers.childcare_extras?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">Special Requirements</h2>
            <div className="flex flex-wrap gap-2">
              {answers.childcare_extras.map((extra: string) => (
                <span key={extra} className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
                  {extra}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Quick Replies */}
        <QuickRepliesCard
          profileId={profile?.id}
          initialReplies={profile?.auto_replies || {}}
        />

        {/* Post new request */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Update Your Needs</h2>
          <p className="text-sm text-gray-400 mb-4">Changed what you're looking for? Post a new request.</p>
          <button onClick={() => router.push('/family/post')}
            className="w-full py-3 rounded-xl text-sm font-medium border-2 border-[#7FB3FF] text-[#7FB3FF] hover:bg-blue-50 transition">
            Post a New Request →
          </button>
        </div>
      </div>
    </div>
  )
}