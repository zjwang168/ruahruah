import Link from 'next/link'
import type { ReactNode } from 'react'

/* Shared shell for the policy pages (/privacy, /terms).
   Content lives in the pages as an array of sections so each section is a
   discrete, translatable unit — no sentence is assembled from fragments. */

export type LegalSection = {
  id: string
  title: string
  body: ReactNode
}

/** Inline marker for anything only the founder or counsel can decide.
    Visible on purpose: an unanswered question should be impossible to miss. */
export function Confirm({ children }: { children: ReactNode }) {
  return (
    <span className="inline bg-amber-50 text-amber-900 border border-amber-200 rounded px-1.5 py-0.5 text-[0.9em] font-medium">
      TO CONFIRM — {children}
    </span>
  )
}

/** Emphasis for a promise or limit a reader should not skim past. */
export function Key({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-ink">{children}</span>
}

export function DraftBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-2xl mx-auto px-6 py-3 flex items-start gap-3">
        <span aria-hidden="true" className="text-base leading-6">
          ⚠️
        </span>
        <p className="text-sm text-amber-900 leading-6">
          <span className="font-semibold">Draft — under legal review.</span>{' '}
          This document is not final and is not yet in effect. It is published
          so it can be reviewed in the open. Highlighted items are still being
          confirmed with counsel.
        </p>
      </div>
    </div>
  )
}

export function LegalDoc({
  title,
  lastUpdated,
  summary,
  sections,
}: {
  title: string
  lastUpdated: string
  summary: ReactNode
  sections: LegalSection[]
}) {
  return (
    <div className="min-h-screen bg-brand-wash">
      <header className="bg-surface border-b border-line px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <img src="/ruah-logo.png" alt="" className="w-7 h-7" />
            <span className="font-bold text-brand">Ruah！</span>
          </Link>
          <span className="text-ink-faint" aria-hidden="true">
            /
          </span>
          <span className="text-sm font-semibold text-ink">{title}</span>
        </div>
      </header>

      <DraftBanner />

      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-ink mb-2">{title}</h1>
        <p className="text-sm text-ink-faint mb-8">
          Draft last updated: {lastUpdated}. Effective date:{' '}
          <Confirm>set on the day counsel signs off and this banner comes down</Confirm>
        </p>

        <div className="bg-brand-soft rounded-card p-6 mb-10">
          <h2 className="text-sm font-semibold text-ink mb-3">The short version</h2>
          <div className="text-sm text-ink-muted leading-relaxed space-y-2">{summary}</div>
          <p className="text-xs text-ink-faint mt-4">
            This summary is here to help you read the rest. The numbered
            sections below are the ones that count.
          </p>
        </div>

        <nav aria-label="Contents" className="mb-12">
          <h2 className="text-sm font-semibold text-ink mb-3">Contents</h2>
          <ol className="text-sm text-ink-muted space-y-1.5">
            {sections.map((section, i) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-brand-strong hover:underline">
                  {i + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10 text-ink-muted leading-relaxed">
          {sections.map((section, i) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-lg font-semibold text-ink mb-3">
                {i + 1}. {section.title}
              </h2>
              <div className="space-y-3">{section.body}</div>
            </section>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-line text-sm">
          <Link href="/" className="text-brand-strong hover:underline">
            ← Back to Ruah
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Bulleted list used throughout both documents. */
export function Points({ children }: { children: ReactNode }) {
  return <ul className="space-y-2 list-disc pl-5">{children}</ul>
}
