import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Where Google sends the reader back.
//
// Until now /onboarding/register pointed signInWithOAuth straight at
// /{role}/dashboard, and nothing in between exchanged the code or wrote a
// `users` row. A Google caller therefore ended up with an auth account, no
// row, no role and no profile — and since 1a61996, on the landing page. The
// database agrees it never worked: all 27 accounts are provider=email.
//
// This route does the one thing that has to happen on the server — swap the
// authorization code for a session cookie — and then hands off to
// /auth/complete, which is a client page because the funnel's context is in
// sessionStorage and the server cannot read it.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const requested = searchParams.get('next')

  // Only same-site paths. `next` arrives in a URL a third party redirected to,
  // so it is attacker-reachable; `//evil.example` is a valid URL and an open
  // redirect, which is why the second character is checked too.
  const next =
    requested && requested.startsWith('/') && !requested.startsWith('//')
      ? requested
      : '/auth/complete'

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/complete?error=oauth`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('auth/callback: code exchange failed —', error.message)
    return NextResponse.redirect(`${origin}/auth/complete?error=oauth`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
