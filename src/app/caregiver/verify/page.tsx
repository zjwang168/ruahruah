'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function CaregiverVerifyPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [idFile, setIdFile] = useState<File | null>(null)
  const [idPreview, setIdPreview] = useState<string | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const { data: userData } = await supabase
        .from('users').select('*').eq('id', authUser.id).single()
      const { data: caregiverData } = await supabase
        .from('caregiver_profiles').select('*').eq('user_id', authUser.id).single()

      setUser(userData)
      setProfile(caregiverData)
      // Pending or verified => show status screen. Rejected => allow re-submit (stays on upload form).
      if (caregiverData?.verification_status === 'pending' || caregiverData?.is_verified) {
        setSubmitted(true)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIdFile(file)
    setIdPreview(URL.createObjectURL(file))
  }

  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelfieFile(file)
    setSelfiePreview(URL.createObjectURL(file))
  }

  const submit = async () => {
    if (!idFile || !selfieFile || !user || !profile) return
    setSubmitting(true)

    try {
      // Upload ID to private bucket
      const idExt = idFile.name.split('.').pop()
      const idPath = `${user.id}/id.${idExt}`
      const { error: idError } = await supabase.storage
        .from('verifications')
        .upload(idPath, idFile, { upsert: true })

      // Upload selfie to private bucket
      const selfieExt = selfieFile.name.split('.').pop()
      const selfiePath = `${user.id}/selfie.${selfieExt}`
      const { error: selfieError } = await supabase.storage
        .from('verifications')
        .upload(selfiePath, selfieFile, { upsert: true })

      if (idError || selfieError) {
        alert('Upload failed. Please try again.')
        setSubmitting(false)
        return
      }

      // Update caregiver profile with verification status
      await supabase.from('caregiver_profiles')
        .update({
          verification_status: 'pending',
          id_photo_path: idPath,
          selfie_path: selfiePath,
          verification_submitted_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      setSubmitted(true)
    } catch (err) {
      alert('Something went wrong. Please try again.')
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  // Already verified
  if (profile?.is_verified) {
    return (
      <div className="min-h-screen bg-[#FAFCFF]">
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => router.push('/caregiver/dashboard')}
            className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
          <div className="font-semibold text-gray-900 text-sm">Identity Verification</div>
        </header>
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">You're verified!</h1>
          <p className="text-sm text-gray-500">Your identity has been confirmed. Families can see your verified badge.</p>
          <button onClick={() => router.push('/caregiver/dashboard')}
            className="mt-6 text-white px-6 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Submitted, pending review
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#FAFCFF]">
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => router.push('/caregiver/dashboard')}
            className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
          <div className="font-semibold text-gray-900 text-sm">Identity Verification</div>
        </header>
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Under review</h1>
          <p className="text-sm text-gray-500">We've received your documents. A person on our team reviews them by hand, typically within 1–2 business days. You'll get a notification once you're verified.</p>
          <button onClick={() => router.push('/caregiver/dashboard')}
            className="mt-6 text-white px-6 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const canSubmit = idFile && selfieFile && !submitting
  const wasRejected = profile?.verification_status === 'rejected'

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push('/caregiver/dashboard')}
          className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex-1">
          <div className="font-semibold text-gray-900 text-sm">Identity Verification</div>
          <div className="text-xs text-gray-400">Build trust with families</div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Rejected notice */}
        {wasRejected && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-xl">⚠️</div>
              <div>
                <div className="font-semibold text-red-700 text-sm">Your previous submission wasn't approved</div>
                <div className="text-xs text-red-600 mt-1">
                  This usually happens when the photos are blurry, cut off, or don't match. Please upload a clear photo of your ID and a well-lit selfie, then submit again.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Why verify */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-[#7FB3FF]/30 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🛡️</div>
            <div>
              <div className="font-semibold text-gray-900 text-sm mb-2">Why get verified?</div>
              <ul className="space-y-1.5 text-xs text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-[#7FB3FF]">✓</span>
                  <span>Verified caregivers get <strong>3x more</strong> family responses</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#7FB3FF]">✓</span>
                  <span>A <strong>✓ Verified</strong> badge appears on your profile</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#7FB3FF]">✓</span>
                  <span>Families feel safer trusting you with their loved ones</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Step 1: ID */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#7FB3FF] font-bold text-sm">1</div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">Upload your ID</div>
              <div className="text-xs text-gray-400">Driver's license, passport, or state ID</div>
            </div>
          </div>
          <label className="block cursor-pointer">
            {idPreview ? (
              <div className="relative">
                <img src={idPreview} alt="ID preview" className="w-full h-48 object-cover rounded-xl border border-gray-200" />
                <div className="absolute inset-0 bg-black/30 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition">
                  <span className="text-white text-sm font-medium">Change photo</span>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center hover:border-[#7FB3FF] transition">
                <div className="text-3xl mb-2">📄</div>
                <div className="text-sm text-gray-500">Tap to upload ID photo</div>
                <div className="text-xs text-gray-300 mt-1">JPG, PNG · Max 10MB</div>
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleIdChange} />
          </label>
        </div>

        {/* Step 2: Selfie */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#7FB3FF] font-bold text-sm">2</div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">Take a selfie</div>
              <div className="text-xs text-gray-400">So we can confirm it's really you</div>
            </div>
          </div>
          <label className="block cursor-pointer">
            {selfiePreview ? (
              <div className="relative">
                <img src={selfiePreview} alt="Selfie preview" className="w-full h-48 object-cover rounded-xl border border-gray-200" />
                <div className="absolute inset-0 bg-black/30 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition">
                  <span className="text-white text-sm font-medium">Change photo</span>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center hover:border-[#7FB3FF] transition">
                <div className="text-3xl mb-2">🤳</div>
                <div className="text-sm text-gray-500">Tap to upload selfie</div>
                <div className="text-xs text-gray-300 mt-1">JPG, PNG · Max 10MB</div>
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleSelfieChange} />
          </label>
        </div>

        {/* Privacy note */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-xs text-gray-500 leading-relaxed">
            🔒 Your photos are stored securely and are only visible to the Ruah team for verification. We never share them with families or third parties. Review typically takes 1–2 business days.{' '}
            <a href="/privacy" target="_blank" className="text-[#7FB3FF] underline">Privacy Policy</a>
          </p>
        </div>

        {/* Submit */}
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm disabled:opacity-40 transition"
          style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
          {submitting ? 'Submitting...' : wasRejected ? 'Re-submit for Verification' : 'Submit for Verification'}
        </button>
        {!canSubmit && !submitting && (
          <p className="text-center text-xs text-gray-400 mt-2">
            Upload both your ID and selfie to continue
          </p>
        )}
      </div>
    </div>
  )
}