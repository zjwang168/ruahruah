import type { Metadata } from 'next'
import Link from 'next/link'

/* Trust & Safety.
   Framing rule for anyone editing this file: INFORM AND GUIDE. Ruah does not
   provide legal services and does not run background checks. Nothing here may
   imply otherwise, including by omission.

   Bilingual readiness: every user-visible string lives in the `copy` object
   below, as a complete sentence. Never concatenate fragments and never
   interpolate a noun into a sentence — zh word order will not survive it. To
   add Chinese, copy this object, translate the values, and select on locale;
   no JSX below needs to change. Layouts use wrapping text and no fixed
   heights, so longer zh/en strings do not break them. */

export const metadata: Metadata = {
  title: 'Trust & Safety — Ruah',
  description:
    'What Ruah verifies, what we do not check, how to arrange your own background check, and what DC law asks of household employers.',
}

const CONTACT_EMAIL = 'zijinwang168@gmail.com'

const LINKS = {
  doesService: 'https://does.dc.gov/service/domestic-worker-employment-rights',
  doesTemplate:
    'https://does.dc.gov/sites/default/files/dc/sites/does/publication/attachments/Domestic%20Worker%20Service%20Contract%20Agreement_template_2023_fill.pdf',
  doesFaq:
    'https://does.dc.gov/sites/default/files/dc/sites/does/publication/attachments/Domestic%20Worker%20FAQs.pdf',
  ftcGuide: 'https://www.ftc.gov/business-guidance/resources/background-checks-what-employers-need-know',
  ndwaRights: 'https://www.domesticworkers.org/resources/know-your-rights/washington-dc-rights/',
}

const copy = {
  pageTitle: 'Trust & Safety',
  pageIntro:
    'Here is what we check, what we do not check, and what we think you should do yourself. We would rather tell you where our checks stop than let you assume they go further than they do.',

  doTitle: 'What we verify today',
  doIntro:
    'Every caregiver who carries a verified badge on Ruah has been through this. A person on our team does it by hand — it is not automated.',
  doItems: [
    {
      emoji: '🪪',
      title: 'Identity verification',
      body: 'A caregiver uploads a government-issued photo ID and a selfie. A member of our team compares the two and either approves the caregiver or asks for clearer photos. Only approved caregivers get the verified badge.',
    },
    {
      emoji: '🔒',
      title: 'Documents stay private',
      body: 'ID photos and selfies are stored in a private location, separate from public profiles. Our reviewers open them through short-lived links that expire within the hour. Families never see them, and neither do other caregivers.',
    },
    {
      emoji: '📝',
      title: 'Profile review',
      body: 'We read caregiver profiles and flag language that suggests working off the books, moving payment off the platform, or other terms that put either side at risk. We can suspend or remove accounts that break our rules.',
    },
    {
      emoji: '💬',
      title: 'Coordination stays on Ruah',
      body: 'Messages, matches, and the commitments people make run through the platform, so there is a record if something later goes wrong.',
    },
  ],

  badgeTitle: 'What the verified badge means — exactly',
  badgeMeans:
    'A verified badge means one thing: we checked a government ID and a selfie, and we believe this person is who they say they are.',
  badgeNotIntro: 'It is not:',
  badgeNot: [
    'a criminal background check',
    'a check of sex offender, child abuse, or driving registries',
    'a check of references, employment history, or certifications',
    "an endorsement, or any judgment about someone's character or fitness to care for your children",
  ],

  dontTitle: 'What we do not do: background checks',
  dontLead: 'Ruah does not run criminal background checks on caregivers.',
  dontBody:
    'No badge, label, or score anywhere on this platform means a caregiver has been background checked, because we have not checked. We would rather say that plainly than let a green checkmark carry a meaning it has not earned.',
  dontRecommend:
    'We recommend that every family arrange a background check before hiring someone to care for their children. It is your decision and your process — here is how to do it properly.',

  howTitle: 'How to arrange your own background check',
  howSteps: [
    {
      title: 'Use a real screening company',
      body: 'Background checks run for hiring purposes are regulated. Use a consumer reporting agency that complies with the federal Fair Credit Reporting Act, not a cheap people-search website. A report from an unregulated site can be wrong, and using it to make a hiring decision can put you on the wrong side of the law.',
    },
    {
      title: 'Get written permission first',
      body: 'Federal law requires you to give the caregiver a clear, standalone written notice that you intend to run a background check, and to get their written authorization before it happens. The notice cannot be buried inside an application form.',
    },
    {
      title: 'Decide what you actually need checked',
      body: 'For in-home childcare, families commonly check criminal records and the sex offender registry, and add a driving record if the caregiver will be driving their children.',
    },
    {
      title: 'Handle a bad result fairly',
      body: 'If you decide not to hire someone because of what the report said, federal law requires you to give them a copy of the report and a summary of their rights before you make that decision final, so they have a chance to correct an error. Reports do contain errors.',
    },
    {
      title: 'Apply the same rule to everyone',
      body: 'It is illegal to check some candidates and not others based on race, national origin, color, sex, religion, disability, genetic information, or age. Pick a policy and apply it to every caregiver you seriously consider.',
    },
  ],
  ftcLinkLabel: 'FTC — Background Checks: What Employers Need to Know',

  caregiverCheckTitle: 'If you are a caregiver and a family asks',
  caregiverCheckBody:
    'A family must ask your permission in writing before running a background check, and you are allowed to say no. Many caregivers agree because it helps them get hired sooner. That is your decision to make, not ours, and declining does not affect your standing on Ruah.',

  lawTitle: 'Hiring in DC? The law asks for a written contract',
  lawLead:
    'If you hire someone to work in your home in the District of Columbia, you are their employer. The Domestic Worker Employment Rights Amendment Act of 2022 requires household employers to give domestic workers a written services contract.',
  lawPoints: [
    'The contract sets out the things people argue about later: pay rate and how often pay arrives, hours and overtime, duties, time off, and how either side can end the arrangement.',
    'You must make a reasonable effort to give the worker the contract in the language they prefer. This is part of the law, not a courtesy.',
    'The contract should be in place when work begins, and you are expected to keep your own records of hours worked and wages paid.',
  ],
  lawTemplateTitle: 'You do not have to draft it yourself',
  lawTemplateBody:
    'The DC Department of Employment Services publishes an official template contract that contains the provisions the law requires. They publish it in seven languages: English, Spanish, Chinese, French, Korean, Vietnamese, and Amharic.',
  lawTemplateNote:
    'Most of the families we serve speak Chinese at home, and many caregivers prefer Spanish. The official template exists in both — use them rather than translating something yourself.',
  lawCaregiverTitle: 'If you are a caregiver',
  lawCaregiverBody:
    'You are entitled to that written contract, in the language you prefer. If you were never given one, you can ask for it, and the Department of Employment Services has a process for workers whose employers will not provide one.',

  disclaimerTitle: 'This is information, not legal advice',
  disclaimerBody:
    'Ruah is not a law firm and does not give legal, tax, or employment advice. This page points you toward the official sources so you can read them yourself or take them to someone who can advise you. Where anything here differs from what the District of Columbia publishes, the District is right and we are not.',

  reportTitle: 'Tell us when something is wrong',
  reportBody:
    'If a profile, a message, or an interaction feels wrong, report it. We read everything that comes in, and we act on anything involving safety. You do not need to be certain before you tell us.',
  reportCta: 'Report something to us',
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-strong hover:underline font-medium"
    >
      {children} ↗
    </a>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-bold text-ink mb-4">{children}</h2>
}

export default function TrustAndSafetyPage() {
  return (
    <div className="min-h-screen bg-brand-wash">
      <header className="bg-surface border-b border-line px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <img src="/ruah-logo.png" alt="" className="w-7 h-7" />
            <span className="font-bold text-brand">Ruah！</span>
          </Link>
          <span className="text-ink-faint" aria-hidden="true">
            /
          </span>
          <span className="text-sm font-semibold text-ink">{copy.pageTitle}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-ink mb-4">{copy.pageTitle}</h1>
        <p className="text-lg text-ink-muted leading-relaxed mb-14">{copy.pageIntro}</p>

        {/* What we verify */}
        <section className="mb-16">
          <SectionHeading>{copy.doTitle}</SectionHeading>
          <p className="text-ink-muted leading-relaxed mb-6">{copy.doIntro}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {copy.doItems.map(item => (
              <div key={item.title} className="bg-surface rounded-card p-6 border border-line">
                <div className="text-2xl mb-3" aria-hidden="true">
                  {item.emoji}
                </div>
                <h3 className="font-semibold text-ink mb-2">{item.title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What the badge means */}
        <section className="mb-16">
          <div className="bg-brand-soft rounded-card p-7">
            <h2 className="text-lg font-semibold text-ink mb-3">{copy.badgeTitle}</h2>
            <p className="text-ink-muted leading-relaxed mb-4">{copy.badgeMeans}</p>
            <p className="text-ink-muted mb-2">{copy.badgeNotIntro}</p>
            <ul className="space-y-1.5 list-disc pl-5 text-ink-muted">
              {copy.badgeNot.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* What we don't do */}
        <section className="mb-16">
          <SectionHeading>{copy.dontTitle}</SectionHeading>
          <div className="bg-surface border-2 border-amber-200 rounded-card p-7 mb-6">
            <p className="text-lg font-semibold text-ink mb-3">{copy.dontLead}</p>
            <p className="text-ink-muted leading-relaxed mb-4">{copy.dontBody}</p>
            <p className="text-ink-muted leading-relaxed">{copy.dontRecommend}</p>
          </div>

          <h3 className="text-lg font-semibold text-ink mb-4">{copy.howTitle}</h3>
          <ol className="space-y-5">
            {copy.howSteps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-brand-soft text-brand-strong text-sm font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <h4 className="font-semibold text-ink mb-1">{step.title}</h4>
                  <p className="text-sm text-ink-muted leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-6 text-sm text-ink-muted">
            <ExternalLink href={LINKS.ftcGuide}>{copy.ftcLinkLabel}</ExternalLink>
          </p>

          <div className="mt-8 bg-warm rounded-card p-6">
            <h3 className="font-semibold text-ink mb-2">{copy.caregiverCheckTitle}</h3>
            <p className="text-sm text-ink-muted leading-relaxed">{copy.caregiverCheckBody}</p>
          </div>
        </section>

        {/* DC law */}
        <section className="mb-16">
          <SectionHeading>{copy.lawTitle}</SectionHeading>
          <p className="text-ink-muted leading-relaxed mb-5">{copy.lawLead}</p>
          <ul className="space-y-3 list-disc pl-5 text-ink-muted leading-relaxed mb-8">
            {copy.lawPoints.map(point => (
              <li key={point}>{point}</li>
            ))}
          </ul>

          <div className="bg-surface rounded-card p-7 border border-line">
            <h3 className="font-semibold text-ink mb-2">{copy.lawTemplateTitle}</h3>
            <p className="text-sm text-ink-muted leading-relaxed mb-3">{copy.lawTemplateBody}</p>
            <p className="text-sm text-ink-muted leading-relaxed mb-5">{copy.lawTemplateNote}</p>
            <div className="flex flex-col gap-2 text-sm">
              <ExternalLink href={LINKS.doesTemplate}>
                Download the official DOES contract template
              </ExternalLink>
              <ExternalLink href={LINKS.doesService}>
                DOES — Domestic Worker Employment Rights
              </ExternalLink>
              <ExternalLink href={LINKS.doesFaq}>
                DOES — Domestic Worker frequently asked questions
              </ExternalLink>
            </div>
          </div>

          <div className="mt-6 bg-warm rounded-card p-6">
            <h3 className="font-semibold text-ink mb-2">{copy.lawCaregiverTitle}</h3>
            <p className="text-sm text-ink-muted leading-relaxed mb-3">{copy.lawCaregiverBody}</p>
            <p className="text-sm">
              <ExternalLink href={LINKS.ndwaRights}>
                Know your rights as a domestic worker in DC
              </ExternalLink>
            </p>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="mb-16">
          <div className="border border-line-strong rounded-card p-6">
            <h2 className="font-semibold text-ink mb-2">{copy.disclaimerTitle}</h2>
            <p className="text-sm text-ink-muted leading-relaxed">{copy.disclaimerBody}</p>
          </div>
        </section>

        {/* Report */}
        <section className="mb-12">
          <SectionHeading>{copy.reportTitle}</SectionHeading>
          <p className="text-ink-muted leading-relaxed mb-5">{copy.reportBody}</p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-block bg-brand-gradient text-white px-6 py-3 rounded-control font-semibold"
          >
            {copy.reportCta}
          </a>
        </section>

        <div className="pt-6 border-t border-line text-sm">
          <Link href="/" className="text-brand-strong hover:underline">
            ← Back to Ruah
          </Link>
        </div>
      </div>
    </div>
  )
}
