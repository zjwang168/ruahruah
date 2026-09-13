import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin/emails'
import {
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_QUERY_PARAM,
} from '@/lib/i18n/config'

// Caregiver-only private subpages. Everything else under /caregiver/ (e.g. /caregiver/{uuid})
// is a public profile page that families need to view, so it is NOT restricted.
const CAREGIVER_PRIVATE_PAGES = [
  'dashboard', 'profile', 'requests', 'verify',
  'applications', 'activity', 'chat', 'onboarding', 'availability',
]

export async function proxy(request: NextRequest) {
  // ?lang=zh pins the language, persists it in the cookie, and vanishes from
  // the URL. This is what a link shared into a WeChat group or printed as a QR
  // code carries: the reader lands in their language on the first byte and
  // never has to find the toggle. Any other query params (?src=... campaign
  // tags) are preserved through the redirect.
  //
  // Runs before the Supabase client on purpose — it must work for a signed-out
  // visitor, and the redirected request does the auth refresh a moment later.
  // API routes are exempt: redirecting a fetch that expects JSON breaks it.
  const requestedLocale = request.nextUrl.searchParams.get(LOCALE_QUERY_PARAM)
  if (isLocale(requestedLocale) && !request.nextUrl.pathname.startsWith('/api/')) {
    const cleanUrl = request.nextUrl.clone()
    cleanUrl.searchParams.delete(LOCALE_QUERY_PARAM)
    const localeResponse = NextResponse.redirect(cleanUrl)
    localeResponse.cookies.set(LOCALE_COOKIE, requestedLocale, {
      path: '/',
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: 'lax',
    })
    return localeResponse
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Unauthenticated users hitting protected pages
  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    const segments = pathname.split('/').filter(Boolean) // e.g. ['caregiver', 'dashboard']
    const isGatedPage =
      segments[0] === 'admin' ||
      segments[0] === 'family' ||
      (segments[0] === 'caregiver' && CAREGIVER_PRIVATE_PAGES.includes(segments[1]))

    // Ban status + role in one query. maybeSingle(), not single(), so that
    // "no row yet" — the window between supabase.auth.signUp and the users
    // insert on the register page — comes back as data:null with NO error.
    // That leaves `error` meaning exactly one thing: the read itself failed.
    const { data: userData, error: userErr } = await supabase
      .from('user_self')
      .select('is_banned, ban_reason, role')
      .maybeSingle()

    // A failed read means we do not know whether this account is banned, and
    // `userData?.is_banned` would quietly answer "not banned" — which is how a
    // ban stops being enforced with nothing on screen looking broken. A
    // renamed view or a revoked grant is enough to trigger it. Fail closed:
    // the signed-in surfaces stay shut until the read works again. Public
    // pages, including the caregiver profile pages, are unaffected.
    if (userErr) {
      console.error('proxy: user_self read failed —', userErr.message)
      if (isGatedPage) return NextResponse.redirect(new URL('/', request.url))
      return supabaseResponse
    }

    // Ban check
    if (userData?.is_banned) {
      if (!pathname.startsWith('/banned')) {
        const url = new URL('/banned', request.url)
        url.searchParams.set('reason', userData.ban_reason || 'Violation of terms of service')
        return NextResponse.redirect(url)
      }
      return supabaseResponse
    }

    const role = userData?.role
    const isAdmin = isAdminEmail(user.email)

    // A caller with no usable role cannot be routed by the three rules below.
    // The family rule sends them to /caregiver/dashboard, the caregiver rule
    // sends them straight back, and the browser spins between the two until it
    // gives up. Reachable in one step: the register page inserts the `users`
    // row AFTER supabase.auth.signUp, so an insert that fails leaves a live
    // session with no row behind it — and `role` is null for the rest of that
    // account's life until someone repairs it by hand.
    //
    // The landing page is where they belong: its two CTAs are the family and
    // caregiver funnels, which is exactly the choice they never completed, and
    // it is public so nothing here can bounce them again. Admins are exempt —
    // the email allowlist is their authorisation, not `role`.
    if (!isAdmin && role !== 'family' && role !== 'caregiver' && isGatedPage) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    // --- Role-based route isolation ---

    // Admin pages: only admin emails
    if (pathname.startsWith('/admin') && !isAdmin) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Family pages: only family role (admins allowed for support)
    if (pathname.startsWith('/family') && role !== 'family' && !isAdmin) {
      return NextResponse.redirect(new URL('/caregiver/dashboard', request.url))
    }

    // Caregiver PRIVATE pages: only caregiver role (admins allowed).
    // Public caregiver profile pages (/caregiver/{uuid}) are NOT restricted.
    if (segments[0] === 'caregiver' && CAREGIVER_PRIVATE_PAGES.includes(segments[1])) {
      if (role !== 'caregiver' && !isAdmin) {
        return NextResponse.redirect(new URL('/family/dashboard', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}