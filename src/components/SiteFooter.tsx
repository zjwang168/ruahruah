import Link from 'next/link'

/* Rendered once from the root layout, so /privacy, /terms and /trust are
   reachable from every page. `mt-auto` pins it to the bottom of the body's
   flex column, below whatever the page rendered. */

const CONTACT_EMAIL = 'zijinwang168@gmail.com'

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface px-6 py-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2">
          <img src="/ruah-logo.png" alt="" className="w-6 h-6" />
          <span className="text-brand font-bold">Ruah！</span>
          <span className="text-ink-faint ml-2">© 2026</span>
        </div>
        <nav aria-label="Legal and safety" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/privacy" className="text-ink-muted hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="text-ink-muted hover:text-ink">
            Terms
          </Link>
          <Link href="/trust" className="text-ink-muted hover:text-ink">
            Trust &amp; Safety
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-ink-muted hover:text-ink">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  )
}
