'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { nameError, fullName as joinName } from '@/lib/names'

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [role, setRole] = useState<'family' | 'caregiver' | ''>('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleRegister = async () => {
    // Checked before signUp, not after: a failed users insert leaves an auth
    // account with no row behind it, and that account then has no role and
    // cannot be routed anywhere.
    const nameProblem = nameError(firstName, lastName)
    if (nameProblem) { setError(nameProblem); return }

    setLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // 创建 users 表记录
      const { error: userError } = await supabase.from('users').insert({
        id: data.user.id,
        email,
        role,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: joinName(firstName, lastName),
      })

      if (userError) {
        setError(userError.message)
        setLoading(false)
        return
      }

      // 创建对应 profile
      if (role === 'family') {
        await supabase.from('family_profiles').insert({ user_id: data.user.id })
        router.push('/family/onboarding')
      } else {
        await supabase.from('caregiver_profiles').insert({ user_id: data.user.id })
        router.push('/caregiver/onboarding')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-sm w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create your account</h1>
        <p className="text-gray-500 mb-8">Join Ruah to find the right care for your family</p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        {/* Step 1: 选角色 */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700 mb-3">I am a...</p>
            <button
              onClick={() => { setRole('family'); setStep(2) }}
              className="w-full border-2 border-gray-200 rounded-xl p-4 text-left hover:border-blue-500 transition"
            >
              <div className="font-semibold text-gray-900">👨‍👩‍👧 Family</div>
              <div className="text-sm text-gray-500 mt-1">I'm looking for care services</div>
            </button>
            <button
              onClick={() => { setRole('caregiver'); setStep(2) }}
              className="w-full border-2 border-gray-200 rounded-xl p-4 text-left hover:border-blue-500 transition"
            >
              <div className="font-semibold text-gray-900">🤝 Caregiver / Helper</div>
              <div className="text-sm text-gray-500 mt-1">I provide care services</div>
            </button>
          </div>
        )}

        {/* Step 2: 填信息 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Sarah"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Chen"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 -mt-2">
              Others see you as “Sarah C.” — your last name is never shown.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="At least 8 characters"
              />
            </div>

            <button
              onClick={handleRegister}
              disabled={loading || !email || !password || !firstName.trim() || !lastName.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>

            <button
              onClick={() => setStep(1)}
              className="w-full text-gray-500 text-sm hover:text-gray-700"
            >
              ← Back
            </button>
          </div>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}