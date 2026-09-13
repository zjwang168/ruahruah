// Find every PostgREST select the browser runs, by reading the source.
//
// WHY THIS EXISTS. Twice on 2026-09-13 a column grant landed while pages were
// still naming the withheld column inside a select, and PostgREST answered the
// WHOLE query with 42501 rather than dropping the column. Four pages rendered
// empty. Both times the regression suite was green, because it was asking a
// shorter question than the product asks — and both times the hand-written
// sweep that was supposed to catch it missed cases, because it filtered LINES
// containing "select" and the offending column sat on a continuation line of a
// multi-line template literal.
//
// A select is not a line. This reads each `.select( ... )` whole, across
// newlines, pairs it with the `.from( ... )` it hangs off, and works out
// whether the caller holds the service role — which bypasses grants and is
// therefore uninteresting — or a browser/session client, which does not.
//
// rls-regression.mjs consumes this AT RUN TIME rather than from a committed
// snapshot. Change a page's select and the next `npm run rls:check` runs the
// new one. There is no list for anyone to forget to update.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = 'src'

// Tables/views whose reads are already governed by their own phases, or which
// exist precisely to be read — asserting them here would only duplicate.
const SKIP_FILES = [/\.test\.tsx?$/, /[\\/]scripts[\\/]/]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(p) && !SKIP_FILES.some(r => r.test(p))) out.push(p)
  }
  return out
}

// Identifiers in this file that hold a SERVICE-ROLE client. Those calls bypass
// column grants entirely, so their selects prove nothing about what a user can
// read. Detected by looking at what the constructor was handed.
function serviceRoleIdents(src) {
  const ids = new Set()
  const re = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?[A-Za-z_$][\w$]*\s*\(/g
  let m
  while ((m = re.exec(src))) {
    const window = src.slice(m.index, m.index + 400)
    if (window.includes('SUPABASE_SERVICE_ROLE_KEY')) ids.add(m[1])
  }
  return ids
}

// Which signed-in role plausibly runs this file. A select under /family only
// ever runs for a family; one under /messages runs for either side, so it is
// asserted as both.
function rolesFor(file) {
  const f = file.replace(/\\/g, '/')
  if (f.includes('/admin/')) return ['admin']
  if (f.includes('/family/')) return ['family']
  if (f.includes('/caregiver/')) return ['caregiver']
  return ['family', 'caregiver']
}

// Columns a migration that is WRITTEN but NOT YET RUN will withhold from
// `authenticated`. The live phase cannot see these — the grant still exists,
// so the query still works — but the page is already scheduled to break. This
// is the check that would have caught both 2026-09-13 outages the day the
// migration was written rather than the day it ran.
//
// Keep in step with the denylists in supabase/migrations/*_grants.sql. When a
// migration has run, its columns can come off this list: the live phase covers
// them from then on.
export const PENDING_DENYLIST = {
  users: ['full_name', 'last_name'],              // 20260913000100 §2
  family_profiles: ['onboarding_answers', 'auto_replies'], // 20260913000100 §3
}

/** Browser-side selects that name a column a pending migration will withhold. */
export function pendingBreakage() {
  const { found } = scanSelects()
  const out = []
  for (const rec of found) {
    for (const [table, cols] of Object.entries(PENDING_DENYLIST)) {
      // Either the select is ON that table, or it embeds it by name. The
      // embed may carry an alias and a foreign-key hint —
      // `sender:users!messages_sender_id_fkey ( ... )` — so match the table
      // name followed by an optional !hint and the paren.
      const onTable = rec.table === table
      const embeds = new RegExp(`\\b${table}(?:![A-Za-z_]+)?\\s*\\(`).test(rec.select)
      if (!onTable && !embeds) continue
      for (const col of cols) {
        if (new RegExp(`\\b${col}\\b`).test(rec.select)) {
          out.push({ ...rec, table, column: col })
        }
      }
    }
  }
  return out
}

export function scanSelects() {
  const found = []
  const skipped = []

  for (const file of walk(SRC)) {
    const src = readFileSync(file, 'utf8')
    const svc = serviceRoleIdents(src)

    // Every `<ident>.from('<table>')`, with the identifier that received it.
    const froms = []
    const fromRe = /([A-Za-z_$][\w$]*)\s*\.\s*from\(\s*['"]([a-zA-Z_]+)['"]\s*\)/g
    let fm
    while ((fm = fromRe.exec(src))) {
      froms.push({ index: fm.index, ident: fm[1], table: fm[2] })
    }

    // Every `.select(<string literal>)`, template literals included, newlines
    // and all. Paired with the nearest preceding .from().
    const selRe = /\.\s*select\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g
    let sm
    while ((sm = selRe.exec(src))) {
      const owner = [...froms].reverse().find(f => f.index < sm.index)
      if (!owner) continue

      const line = src.slice(0, sm.index).split('\n').length
      const where = `${relative('.', file)}:${line}`
      const raw = sm[1]
      const body = raw.slice(1, -1)

      if (svc.has(owner.ident)) continue                    // service role: bypasses grants
      if (/\$\{/.test(body)) {                              // interpolated: cannot run verbatim
        skipped.push({ where, table: owner.table, reason: 'interpolated select' })
        continue
      }
      found.push({
        where,
        table: owner.table,
        select: body.replace(/\s+/g, ' ').trim(),
        roles: rolesFor(file),
      })
    }
  }
  return { found, skipped }
}

// `node scripts/lib/scan-selects.mjs` prints the inventory.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { found, skipped } = scanSelects()
  const byTable = {}
  for (const f of found) (byTable[f.table] ||= []).push(f)
  for (const [table, rows] of Object.entries(byTable).sort()) {
    console.log(`\n${table}  (${rows.length})`)
    for (const r of rows) console.log(`  ${r.where}  [${r.roles.join('|')}]  ${r.select.slice(0, 110)}`)
  }
  console.log(`\n${found.length} browser-side selects`)
  if (skipped.length) {
    console.log(`\nnot asserted (${skipped.length}):`)
    for (const s of skipped) console.log(`  ${s.where}  ${s.reason}`)
  }
}
