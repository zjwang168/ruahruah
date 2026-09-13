import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Distance from the caller to each open request, in miles.
//
// WHY THIS EXISTS. /caregiver/requests used to read every family's `zipcode`
// straight out of `users` with the anon key, geocode each one from the
// browser, and render "12 mi away". The zipcodes were never displayed — the
// page only ever showed the distance — but every one of them reached the
// browser of any caregiver looking at the board, and a home zipcode plus a
// name is a locating pair. 20260805000000 revokes `zipcode` from
// `authenticated` precisely so that read cannot happen, which would have left
// the distance column permanently blank.
//
// So the computation moves here. Both zipcodes are resolved with the service
// role, geocoded server-side, and only the mileage crosses back. The caller's
// own zipcode comes from the SESSION, never the request body — the body
// carries request ids and nothing else, and a caller who names a request he
// cannot see simply gets no entry for it.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_REQUESTS = 100
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Zip → coords, for the life of the server process. Zip centroids do not move,
// and without this a board of 40 requests is 40 outbound calls per page load.
const geocache = new Map<string, { lat: number; lng: number } | null>()

async function getLatLng(zipcode: string) {
  if (geocache.has(zipcode)) return geocache.get(zipcode)!
  let result: { lat: number; lng: number } | null = null
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zipcode}`)
    if (res.ok) {
      const place = (await res.json()).places?.[0]
      if (place) result = { lat: parseFloat(place.latitude), lng: parseFloat(place.longitude) }
    }
  } catch {
    // Leave result null. A geocoding outage costs the distance chip, nothing else.
  }
  geocache.set(zipcode, result)
  return result
}

// The precision that crosses the wire is itself a disclosure. A caregiver can
// edit her OWN zipcode (/caregiver/profile writes users.zipcode), so a
// full-precision mileage is a ruler she can re-aim: set a zip, read the
// distance, move, read again. Three readings and the family's zip centroid
// falls out of the intersection — which is the value this route exists to keep
// on the server.
//
// The board renders `distance < 1 ? '< 1' : Math.round(distance)`, so whole
// miles is all the UI has ever shown. Rounding here costs the product nothing
// and stops the wire carrying more than the screen does. Sub-mile collapses to
// 0 so the '< 1' label still reads the same.
//
// This narrows the leak rather than closing it: whole miles still trilaterates
// to a few square miles. Closing it entirely means returning only the
// 10/25/50/100 filter buckets and dropping the exact figure from the card —
// a product call, not one to make here.
function quantize(miles: number) {
  return miles < 1 ? 0 : Math.round(miles)
}

function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST(req: NextRequest) {
  try {
    // 1. Identity from the session cookie. getUser() revalidates the token.
    const session = await createSessionClient()
    const { data: { user }, error: authErr } = await session.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // 2. The body carries request ids and nothing else.
    const body = await req.json().catch(() => null)
    const ids: unknown = body?.requestIds
    if (!Array.isArray(ids)) {
      return NextResponse.json({ error: 'requestIds must be an array' }, { status: 400 })
    }
    const requestIds = [...new Set(ids.filter((v): v is string => typeof v === 'string' && UUID.test(v)))]
    if (requestIds.length === 0) return NextResponse.json({ distances: {} })
    if (requestIds.length > MAX_REQUESTS) {
      return NextResponse.json({ error: `At most ${MAX_REQUESTS} requests` }, { status: 400 })
    }

    // 3. The caller's own zipcode, keyed by the session's user id.
    const { data: me } = await admin
      .from('users').select('zipcode').eq('id', user.id).single()
    const myLatLng = me?.zipcode ? await getLatLng(me.zipcode) : null
    if (!myLatLng) return NextResponse.json({ distances: {} })

    // 4. The other end. Only open requests resolve — a caller who names a
    //    closed or non-existent one gets no entry rather than an error.
    const { data: rows } = await admin
      .from('service_requests')
      .select('id, family_profiles!inner ( users!inner ( zipcode ) )')
      .in('id', requestIds)
      .eq('status', 'open')

    const distances: Record<string, number> = {}
    for (const row of rows || []) {
      const zip = (row as any).family_profiles?.users?.zipcode
      if (!zip) continue
      const there = await getLatLng(zip)
      if (there) {
        distances[(row as any).id] =
          quantize(milesBetween(myLatLng.lat, myLatLng.lng, there.lat, there.lng))
      }
    }

    // 5. Whole miles only. No zipcode has left the server.
    return NextResponse.json({ distances })
  } catch (err) {
    console.error('request-distances error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
