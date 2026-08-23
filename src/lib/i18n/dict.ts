import type { Locale } from './config'

// The string table.
//
// FLAT KEYS ON PURPOSE. A nested tree reads nicer in the file and worse
// everywhere else: you cannot grep `home.hero.line1` back to its use site, and
// a missing branch fails at runtime instead of at build. Flat keys grep, and
// the `Record<keyof typeof en, string>` annotation on `zh` below turns a
// missing translation into a TYPE ERROR rather than a blank space on the page.
//
// ── THE CHINESE IS A FIRST DRAFT ─────────────────────────────────────
// Translation is not copywriting, and the wedge is Chinese families — this
// page is the first thing they see. The English was written to sell; the
// Chinese below carries the same meaning but has not been written to sell to
// the same reader. Treat every `zh` string as a starting point to edit, not a
// finished line. The ones most worth rewriting are the hero (`home.hero.*`)
// and the CTA (`home.cta.*`).
//
// ── LAYOUT NOTE ──────────────────────────────────────────────────────
// Chinese runs roughly half the character count of the English. Buttons and
// cards sized to "Get started" look empty holding "开始使用". Check both
// locales after editing anything that sits in a fixed-width box.

export const en = {
  // ── chrome ──
  'nav.signin': 'Sign in',
  'nav.getStarted': 'Get started',
  'lang.switchTo': 'Switch language',

  // ── <head> / share card ──
  // These are what a link unfurls as in a group chat, so they are the first
  // Ruah sentence most people ever read. Resolved server-side in layout.tsx
  // from the request locale — see generateMetadata there.
  'meta.title': 'Ruah — childcare for DC families, without the chasing',
  'meta.description':
    'Tell us what your family needs. Ruah reaches out to caregivers, follows up, and reports back — so you are not the one chasing replies.',

  // ── hero ──
  'home.hero.badge': '✨ AI-powered family care',
  'home.hero.line1': 'Find trusted care',
  'home.hero.line2': 'for your family —',
  'home.hero.line3': 'without the stress.',
  'home.hero.sub':
    'We match your family with the right caregiver automatically. Nannies, babysitters, after-school and newborn care — childcare that feels right.',
  'home.hero.ctaFamily': 'Find a caregiver →',
  'home.hero.ctaCaregiver': "I'm a caregiver",
  'home.hero.assurances': '✓ Free to browse   ✓ ID-checked caregivers   ✓ No commitment',
  'home.hero.humanPrompt': 'Prefer to start with a human?',
  'home.hero.humanLink': 'Book 30 minutes with the Ruah Team →',

  // ── hero visual ──
  // The two floating cards illustrate what Ruah DOES — it is the one thing
  // families cannot get from a directory. They deliberately show no caregiver,
  // no name and no rating: there is no rating system, and a fabricated person
  // on the landing page is the kind of detail that gets screenshotted.
  //
  // "Background check / Verified" used to live here and directly contradicted
  // /trust, which states that no badge on this platform means anyone has been
  // background checked. Wording here must stay inside what /trust claims: we
  // check a government ID against a selfie, by hand, and nothing more.
  'home.card.greeting': "Hi! I'm Ruah! 👋",
  'home.card.working.label': 'Ruah is on it',
  'home.card.working.value': 'Reaching out to caregivers…',
  'home.card.verified.label': 'Verified caregiver',
  'home.card.verified.value': 'ID + selfie checked ✓',

  // ── how it works ──
  'home.how.title': 'How Ruah works',
  'home.how.sub': 'Simple, fast, and stress-free',
  'home.how.1.title': 'Tell us your needs',
  'home.how.1.desc':
    "Answer a few quick questions about your family and what kind of help you're looking for.",
  'home.how.2.title': 'We find your match',
  'home.how.2.desc':
    'Our AI reviews caregivers based on your schedule, language, budget, and preferences.',
  'home.how.3.title': 'Meet & hire',
  'home.how.3.desc': 'Connect with your top matches, chat, and hire — all in one place.',

  // ── trust ──
  'home.trust.title': "We don't run background checks.",
  'home.trust.sub':
    'No badge on this platform means anyone has been checked for a criminal record. We have not checked, so we will not let a tick mark carry a meaning it has not earned. Here is what we do check:',
  'home.trust.identity.title': 'Identity verified',
  'home.trust.identity.desc':
    'Every verified caregiver has had a government ID and a selfie checked by a person on our team.',
  'home.trust.docs.title': 'Documents stay private',
  'home.trust.docs.desc':
    'ID photos are stored privately and are never shown to families. Ever.',
  'home.trust.record.title': 'Coordination on Ruah',
  'home.trust.record.desc':
    'Messages and the commitments people make stay on the platform, so there is always a record.',
  'home.trust.noChecksLink': "What that means, and how to arrange a check yourself →",

  // ── closing cta ──
  'home.cta.title': 'Ready to find your perfect match?',
  'home.cta.sub': 'Get started in minutes. No credit card required.',
  'home.cta.button': 'Find care for my family →',
  'home.cta.caregiverPrompt': 'Are you a caregiver?',
  'home.cta.caregiverLink': 'Join here',
} as const

export type MessageKey = keyof typeof en

// The annotation is the whole point: drop a key here and `tsc` fails.
export const zh: Record<MessageKey, string> = {
  'meta.title': 'Ruah — 华府家庭找照护者，不用自己追着问',
  'meta.description':
    '告诉我们家里需要什么。Ruah 替你联系照护者、替你追进度、把结果告诉你，不用你一条条去催。',

  'nav.signin': '登录',
  'nav.getStarted': '开始使用',
  'lang.switchTo': '切换语言',

  'home.hero.badge': '✨ AI 驱动的家庭照护',
  'home.hero.line1': '为家里找到',
  'home.hero.line2': '放心的照护者 —',
  'home.hero.line3': '不必自己追着问。',
  'home.hero.sub':
    '我们自动为你匹配合适的照护者。住家保姆、临时看护、放学接送、新生儿照料 —— 让人安心的托育。',
  'home.hero.ctaFamily': '找照护者 →',
  'home.hero.ctaCaregiver': '我是照护者',
  'home.hero.assurances': '✓ 免费浏览   ✓ 照护者已核验证件   ✓ 无需承诺',
  'home.hero.humanPrompt': '想先和真人聊聊？',
  'home.hero.humanLink': '预约 Ruah 团队 30 分钟 →',

  'home.card.greeting': '你好，我是 Ruah！👋',
  'home.card.working.label': 'Ruah 正在跟进',
  'home.card.working.value': '正在替你联系照护者…',
  'home.card.verified.label': '已核验的照护者',
  'home.card.verified.value': '证件与自拍已核对 ✓',

  'home.how.title': 'Ruah 如何运作',
  'home.how.sub': '简单、快速、不操心',
  'home.how.1.title': '说说你的需求',
  'home.how.1.desc': '回答几个简单问题：家里的情况，以及你需要什么样的帮手。',
  'home.how.2.title': '我们替你匹配',
  'home.how.2.desc': 'AI 会按你的时间安排、语言、预算和偏好筛选照护者。',
  'home.how.3.title': '见面并雇佣',
  'home.how.3.desc': '与最合适的人选联系、沟通、雇佣 —— 都在一个地方完成。',

  'home.trust.title': '我们不做背景调查。',
  'home.trust.sub':
    '平台上没有任何标记代表某个人被查过底细。我们没查，就不会让一个对勾去承担它担不起的意思。我们查的是这三样：',
  'home.trust.identity.title': '身份已验证',
  'home.trust.identity.desc':
    '每一位通过验证的照护者，都由我们团队的真人核对过政府证件和本人照片。',
  'home.trust.docs.title': '证件不外泄',
  'home.trust.docs.desc': '证件照片私密存储，永远不会展示给家庭。绝不。',
  'home.trust.record.title': '协调都留在 Ruah 上',
  'home.trust.record.desc': '消息、以及各方做出的承诺都留在平台上，任何时候都有记录可查。',
  'home.trust.noChecksLink': '这意味着什么，以及如何自行安排背景调查 →',

  'home.cta.title': '准备好找到合适的人了吗？',
  'home.cta.sub': '几分钟就能开始。无需信用卡。',
  'home.cta.button': '为我的家庭找照护 →',
  'home.cta.caregiverPrompt': '你是照护者吗？',
  'home.cta.caregiverLink': '从这里加入',
}

export const DICT: Record<Locale, Record<MessageKey, string>> = { en, zh }
