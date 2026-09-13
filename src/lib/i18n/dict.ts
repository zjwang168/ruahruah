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
  'home.hero.assurances': '✓ Free to browse   ✓ Verified caregivers   ✓ No commitment',
  'home.hero.humanPrompt': 'Prefer to start with a human?',
  'home.hero.humanLink': 'Book 30 minutes with the Ruah Team →',

  // ── hero visual ──
  // The two floating cards mock up a match: a caregiver, a rating, a
  // background-check badge. Restored verbatim at the founder's direction on
  // 2026-09-13 after an earlier commit had replaced them — this wording is
  // deliberate, so do not "correct" it again without asking.
  //
  // Two of them run ahead of the product, and neither should be carried into a
  // new surface: there is no rating system behind "⭐ 4.9", and /trust states
  // that no badge on this platform means anyone has been background checked.
  'home.card.greeting': "Hi! I'm Ruah! 👋",
  'home.card.matchFound': 'Match found! 🎉',
  'home.card.matchName': 'Sarah Chen',
  'home.card.matchMeta': '⭐ 4.9 · Mandarin speaker',
  'home.card.checkLabel': 'Background check',
  'home.card.checkValue': 'Verified ✓',

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

  // ── services ──
  'home.services.title': 'Childcare, however you need it',
  'home.services.sub': 'From full-time help to the occasional evening',
  'home.services.fulltime.label': 'Full-time nanny',
  'home.services.fulltime.desc': 'Weekday care in your home',
  'home.services.afterschool.label': 'After school',
  'home.services.afterschool.desc': 'Pickup, homework, dinner',
  'home.services.evenings.label': 'Evenings & weekends',
  'home.services.evenings.desc': 'Date nights and one-offs',
  'home.services.newborn.label': 'Newborn support',
  'home.services.newborn.desc': 'The first months at home',
  'home.services.bilingual.label': 'Bilingual care',
  'home.services.bilingual.desc': 'Mandarin, Cantonese, Spanish',
  'home.services.breaks.label': 'School breaks',
  'home.services.breaks.desc': 'Holidays and summer',

  // ── trust ──
  'home.trust.title': 'How we handle trust',
  'home.trust.sub': "What we check, and what we don't. In plain terms.",
  'home.trust.identity.title': 'Identity verified',
  'home.trust.identity.desc':
    'Every verified caregiver has had a government ID and a selfie checked by a person on our team.',
  'home.trust.docs.title': 'Documents stay private',
  'home.trust.docs.desc':
    'ID photos are stored privately and are never shown to families. Ever.',
  'home.trust.record.title': 'Coordination on Ruah',
  'home.trust.record.desc':
    'Messages and the commitments people make stay on the platform, so there is always a record.',
  'home.trust.noChecks': "We don't run background checks.",
  'home.trust.noChecksLink': 'What that means, and how to arrange a check yourself →',

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
  'home.hero.assurances': '✓ 免费浏览   ✓ 照护者已验证   ✓ 无需承诺',
  'home.hero.humanPrompt': '想先和真人聊聊？',
  'home.hero.humanLink': '预约 Ruah 团队 30 分钟 →',

  'home.card.greeting': '你好，我是 Ruah！👋',
  'home.card.matchFound': '匹配成功！🎉',
  'home.card.matchName': 'Sarah Chen',
  'home.card.matchMeta': '⭐ 4.9 · 会说普通话',
  'home.card.checkLabel': '背景调查',
  'home.card.checkValue': '已验证 ✓',

  'home.how.title': 'Ruah 如何运作',
  'home.how.sub': '简单、快速、不操心',
  'home.how.1.title': '说说你的需求',
  'home.how.1.desc': '回答几个简单问题：家里的情况，以及你需要什么样的帮手。',
  'home.how.2.title': '我们替你匹配',
  'home.how.2.desc': 'AI 会按你的时间安排、语言、预算和偏好筛选照护者。',
  'home.how.3.title': '见面并雇佣',
  'home.how.3.desc': '与最合适的人选联系、沟通、雇佣 —— 都在一个地方完成。',

  'home.services.title': '你需要的每一种托育',
  'home.services.sub': '从全职帮手，到偶尔的一个晚上',
  'home.services.fulltime.label': '全职保姆',
  'home.services.fulltime.desc': '工作日上门照护',
  'home.services.afterschool.label': '放学后',
  'home.services.afterschool.desc': '接送、作业、晚餐',
  'home.services.evenings.label': '晚间与周末',
  'home.services.evenings.desc': '约会之夜与临时需求',
  'home.services.newborn.label': '新生儿照料',
  'home.services.newborn.desc': '在家的头几个月',
  'home.services.bilingual.label': '双语照护',
  'home.services.bilingual.desc': '普通话、粤语、西班牙语',
  'home.services.breaks.label': '假期',
  'home.services.breaks.desc': '节假日与暑假',

  'home.trust.title': '我们如何处理信任',
  'home.trust.sub': '我们查什么，不查什么。把话说明白。',
  'home.trust.identity.title': '身份已验证',
  'home.trust.identity.desc':
    '每一位通过验证的照护者，都由我们团队的真人核对过政府证件和本人照片。',
  'home.trust.docs.title': '证件不外泄',
  'home.trust.docs.desc': '证件照片私密存储，永远不会展示给家庭。绝不。',
  'home.trust.record.title': '协调都留在 Ruah 上',
  'home.trust.record.desc': '消息、以及各方做出的承诺都留在平台上，任何时候都有记录可查。',
  'home.trust.noChecks': '我们不做背景调查。',
  'home.trust.noChecksLink': '这意味着什么，以及如何自行安排背景调查 →',

  'home.cta.title': '准备好找到合适的人了吗？',
  'home.cta.sub': '几分钟就能开始。无需信用卡。',
  'home.cta.button': '为我的家庭找照护 →',
  'home.cta.caregiverPrompt': '你是照护者吗？',
  'home.cta.caregiverLink': '从这里加入',
}

// ── THE SPANISH IS A FIRST DRAFT TOO ─────────────────────────────────
// Written for Spanish speakers in the United States: `niñera` rather than
// `canguro`, `tú` rather than `usted` or `vosotros`, and `match` left in place
// where US Spanish already uses it. Same caveat as the Chinese above — it
// carries the meaning but has not been written to sell. The hero
// (`home.hero.*`) and the CTA (`home.cta.*`) are the lines most worth a
// native rewrite.
//
// Gendered nouns: the caregiver side is mostly but not only women, so the
// generic plural is `cuidadores` and the singular is written `cuidador(a)`
// rather than assuming. `home.cta.title` is addressed to the family in the
// plural (`¿Listos...?`) to avoid picking a gender for one reader.
//
// LAYOUT: Spanish runs roughly 20-30% longer than the English. The hero
// headline wraps to an extra line below about 380px, which is expected.
export const es: Record<MessageKey, string> = {
  'meta.title': 'Ruah — cuidado de niños para familias de DC, sin tener que insistir',
  'meta.description':
    'Dinos qué necesita tu familia. Ruah contacta a los cuidadores, les da seguimiento y te cuenta cómo va — así no eres tú quien anda persiguiendo respuestas.',

  'nav.signin': 'Iniciar sesión',
  'nav.getStarted': 'Comenzar',
  'lang.switchTo': 'Cambiar idioma',

  'home.hero.badge': '✨ Cuidado familiar con IA',
  'home.hero.line1': 'Encuentra cuidado de confianza',
  'home.hero.line2': 'para tu familia —',
  'home.hero.line3': 'sin el estrés.',
  'home.hero.sub':
    'Conectamos a tu familia con la persona indicada, de forma automática. Niñeras, cuidado por horas, después de la escuela y para recién nacidos — cuidado que se siente bien.',
  'home.hero.ctaFamily': 'Buscar cuidador(a) →',
  'home.hero.ctaCaregiver': 'Soy cuidador(a)',
  'home.hero.assurances': '✓ Explorar es gratis   ✓ Cuidadores verificados   ✓ Sin compromiso',
  'home.hero.humanPrompt': '¿Prefieres empezar con una persona?',
  'home.hero.humanLink': 'Agenda 30 minutos con el equipo de Ruah →',

  'home.card.greeting': '¡Hola! ¡Soy Ruah! 👋',
  'home.card.matchFound': '¡Match encontrado! 🎉',
  'home.card.matchName': 'Sarah Chen',
  'home.card.matchMeta': '⭐ 4.9 · Habla mandarín',
  'home.card.checkLabel': 'Verificación de antecedentes',
  'home.card.checkValue': 'Verificado ✓',

  'home.how.title': 'Cómo funciona Ruah',
  'home.how.sub': 'Simple, rápido y sin estrés',
  'home.how.1.title': 'Cuéntanos qué necesitas',
  'home.how.1.desc':
    'Responde unas preguntas rápidas sobre tu familia y el tipo de ayuda que buscas.',
  'home.how.2.title': 'Encontramos tu match',
  'home.how.2.desc':
    'Nuestra IA revisa a los cuidadores según tu horario, idioma, presupuesto y preferencias.',
  'home.how.3.title': 'Conoce y contrata',
  'home.how.3.desc':
    'Conéctate con tus mejores opciones, conversa y contrata — todo en un solo lugar.',

  'home.services.title': 'Cuidado de niños, como lo necesites',
  'home.services.sub': 'Desde ayuda de tiempo completo hasta una noche ocasional',
  'home.services.fulltime.label': 'Niñera de tiempo completo',
  'home.services.fulltime.desc': 'Cuidado entre semana en tu casa',
  'home.services.afterschool.label': 'Después de la escuela',
  'home.services.afterschool.desc': 'Recoger, tareas, cena',
  'home.services.evenings.label': 'Noches y fines de semana',
  'home.services.evenings.desc': 'Salidas en pareja y ocasiones puntuales',
  'home.services.newborn.label': 'Apoyo con recién nacidos',
  'home.services.newborn.desc': 'Los primeros meses en casa',
  'home.services.bilingual.label': 'Cuidado bilingüe',
  'home.services.bilingual.desc': 'Mandarín, cantonés, español',
  'home.services.breaks.label': 'Vacaciones escolares',
  'home.services.breaks.desc': 'Días feriados y verano',

  'home.trust.title': 'Cómo manejamos la confianza',
  'home.trust.sub': 'Qué verificamos y qué no. Sin rodeos.',
  'home.trust.identity.title': 'Identidad verificada',
  'home.trust.identity.desc':
    'A cada cuidador verificado, una persona de nuestro equipo le revisó una identificación oficial y una selfie.',
  'home.trust.docs.title': 'Los documentos son privados',
  'home.trust.docs.desc':
    'Las fotos de identificación se guardan de forma privada y nunca se les muestran a las familias. Nunca.',
  'home.trust.record.title': 'La coordinación ocurre en Ruah',
  'home.trust.record.desc':
    'Los mensajes y los compromisos que cada persona asume quedan en la plataforma, así siempre hay un registro.',
  'home.trust.noChecks': 'No hacemos verificación de antecedentes.',
  'home.trust.noChecksLink': 'Qué significa eso y cómo hacer tu propia verificación →',

  'home.cta.title': '¿Listos para encontrar a la persona indicada?',
  'home.cta.sub': 'Empieza en minutos. No se necesita tarjeta de crédito.',
  'home.cta.button': 'Buscar cuidado para mi familia →',
  'home.cta.caregiverPrompt': '¿Eres cuidador(a)?',
  'home.cta.caregiverLink': 'Regístrate aquí',
}

export const DICT: Record<Locale, Record<MessageKey, string>> = { en, zh, es }
