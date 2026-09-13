'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n/provider'
import { nameError } from '@/lib/names'
import {
  createAccountRows,
  readPendingSignup,
  clearPendingSignup,
  type SignupRole,
  type Answers,
} from '@/lib/signup'

// The page every account passes through once, before it has a `users` row.
//
// Reached three ways:
//   - straight after Google, via /auth/callback
//   - by anyone signed in whose row is missing — src/proxy.ts sends them here
//     rather than to the landing page, which is how the one orphaned account
//     in the database repairs itself on next sign-in, with no hand editing
//   - not at all, if the row already exists: this bounces to the dashboard
//
// Google's given_name / family_name PREFILL the fields; they are never written
// straight through. A Google account whose name is 李明华 would fail
// users_latin_name_ck, and the reader would meet a raw Postgres constraint
// error for a choice nobody asked them to make. Transliterating for them is
// worse — Li Minghua or Minghua Li is a guess about someone's own name, shown
// to the other side of a marketplace. So the fields are theirs to confirm.

function CompleteForm() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const t = useT()

  const [checking, setChecking] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<SignupRole | ''>('')
  const [answers, setAnswers] = useState<Answers>({})
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  useEffect(() => {
    const run = async () => {
      if (params.get('error') === 'oauth') setError(t('auth.err.oauth'))

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // maybeSingle, not single: "no row yet" is the normal case here and is
      // not an error.
      const { data: row } = await supabase.from('user_self').select('role').maybeSingle()
      if (row?.role === 'family' || row?.role === 'caregiver') {
        router.replace(`/${row.role}/dashboard`)
        return
      }

      const pending = readPendingSignup()
      setRole(pending.role ?? '')
      setAnswers(pending.answers)

      const meta = (user.user_metadata ?? {}) as Record<string, unknown>
      if (typeof meta.given_name === 'string') setFirstName(meta.given_name)
      if (typeof meta.family_name === 'string') setLastName(meta.family_name)

      setUserId(user.id)
      setEmail(user.email ?? '')
      setChecking(false)
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    if (!role) return
    const problem = nameError(firstName, lastName)
    if (problem) { setError(t(problem)); return }

    setSaving(true)
    setError('')
    const { errorKey } = await createAccountRows(supabase, {
      userId, email, role, firstName, lastName, answers,
    })
    if (errorKey) { setError(t(errorKey)); setSaving(false); return }

    clearPendingSignup()
    router.push(`/${role}/dashboard`)
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p className="text-sm text-ink-faint">{t('auth.complete.checking')}</p>
      </div>
    )
  }

  const ready = !!role && !!firstName.trim() && !!lastName.trim()

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/ruah-logo.png" alt="Ruah" className="w-14 h-14 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">{t('auth.complete.title')}</h1>
          <p className="text-gray-400 text-sm mt-1">{t('auth.complete.sub')}</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</div>
        )}

        {/* Only when the funnel context did not survive — a direct sign-in, or
            storage the browser would not give us. */}
        {!role && (
          <div className="space-y-3 mb-4">
            <p className="text-sm font-medium text-gray-700">{t('auth.register.rolePrompt')}</p>
            <button onClick={() => setRole('family')}
              className="w-full border-2 border-gray-200 rounded-2xl p-4 text-left hover:border-[#7FB3FF] transition">
              <div className="font-semibold text-gray-900">{t('auth.register.role.family')}</div>
              <div className="text-sm text-gray-500 mt-1">{t('auth.register.role.familyDesc')}</div>
            </button>
            <button onClick={() => setRole('caregiver')}
              className="w-full border-2 border-gray-200 rounded-2xl p-4 text-left hover:border-[#7FB3FF] transition">
              <div className="font-semibold text-gray-900">{t('auth.register.role.caregiver')}</div>
              <div className="text-sm text-gray-500 mt-1">{t('auth.register.role.caregiverDesc')}</div>
            </button>
          </div>
        )}

        {role && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]"
                placeholder={t('auth.field.firstName')} aria-label={t('auth.field.firstName')} />
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]"
                placeholder={t('auth.field.lastName')} aria-label={t('auth.field.lastName')} />
            </div>
            <button onClick={submit} disabled={saving || !ready}
              className="w-full text-white py-4 rounded-2xl font-semibold disabled:opacity-40 transition"
              style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
              {saving ? t('auth.complete.submitting') : t('auth.complete.submit')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CompletePage() {
  return (
    <Suspense fallback={null}>
      <CompleteForm />
    </Suspense>
  )
}
