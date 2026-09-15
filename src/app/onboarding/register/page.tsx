'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { nameError } from '@/lib/names'
import { useT } from '@/lib/i18n/provider'
import { createAccountRows, stashPendingSignup, type SignupRole } from '@/lib/signup'

function RegisterForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const t = useT()

  const role = searchParams.get('role') as SignupRole
  const answers = JSON.parse(decodeURIComponent(searchParams.get('answers') || '{}'))

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Already signed in with an account: this is the SECOND side being added,
  // not a sign-up. The name is on file and there is no password to set, so the
  // funnel's context is stashed and /auth/complete writes the one missing
  // profile row. Someone signed in whose users row is missing falls through
  // to the form below, which /auth/complete would otherwise also handle.
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: row } = await supabase.from('user_self').select('id').maybeSingle()
      if (!row) return
      stashPendingSignup(role, answers)
      router.replace('/auth/complete')
    }
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRegister = async () => {
    // Before signUp: a failed users insert would strand an auth account with
    // no row, no role and nowhere to be routed.
    const nameProblem = nameError(firstName, lastName)
    if (nameProblem) { setError(t(nameProblem)); return }

    setLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) { setError(signUpError.message); setLoading(false); return }
    if (!data.user) { setLoading(false); return }

    const { errorKey } = await createAccountRows(supabase, {
      userId: data.user.id, email, role, firstName, lastName, answers,
    })
    if (errorKey) { setError(t(errorKey)); setLoading(false); return }

    router.push(`/${role}/dashboard`)
  }

  const handleGoogle = async () => {
    // The round trip to Google drops the query string, and the intake answers
    // have no business in a third party's referrer log either — so the funnel
    // context waits in sessionStorage and /auth/complete picks it up.
    stashPendingSignup(role, answers)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/auth/complete` }
    })
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/ruah-logo.png" alt="Ruah" className="w-14 h-14 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">{t('auth.onboarding.title')}</h1>
          <p className="text-gray-400 text-sm mt-1">{t('auth.onboarding.sub')}</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</div>
        )}

        <button onClick={handleGoogle}
          className="w-full border-2 border-gray-200 rounded-2xl py-4 flex items-center justify-center gap-3 font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition mb-3">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {t('auth.google')}
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-400 text-sm">{t('auth.or')}</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]"
              placeholder={t('auth.field.firstName')} aria-label={t('auth.field.firstName')} />
            <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
              className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]"
              placeholder={t('auth.field.lastName')} aria-label={t('auth.field.lastName')} />
          </div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]"
            placeholder={t('auth.field.email')} aria-label={t('auth.field.email')} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]"
            placeholder={`${t('auth.field.password')} — ${t('auth.field.passwordHint')}`} aria-label={t('auth.field.password')} />
          <button onClick={handleRegister} disabled={loading || !firstName.trim() || !lastName.trim() || !email || !password}
            className="w-full text-white py-4 rounded-2xl font-semibold disabled:opacity-40 transition"
            style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
            {loading ? t('auth.register.submitting') : `${t('auth.register.submit')} →`}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          {t('auth.register.terms')}
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}