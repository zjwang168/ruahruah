/* Regenerates src/app/opengraph-image.png — the picture that shows up when a
   Ruah link is pasted into a WeChat group, iMessage, Slack or X.
 *
 * Run with `node scripts/make-og-image.mjs` after changing the logo. The
 * output is committed; nothing generates it at build or request time, so the
 * fonts on the machine that runs this script are the only ones that matter.
 *
 * Deliberately WORDLESS apart from the Latin wordmark. The card is served to
 * Chinese and English readers alike and og:title carries the sentence, in the
 * reader's language, from src/lib/i18n/dict.ts. Baking one language into the
 * image would strand the other.
 *
 * 1200x630 is the Open Graph standard. Everything that matters is centred
 * because WeChat crops the thumbnail to a square. */

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const WIDTH = 1200
const HEIGHT = 630
const LOGO_SIZE = 300

const root = process.cwd()
const OUT = join(root, 'src/app/opengraph-image.png')

// Same tokens as the @theme block in globals.css: brand-soft -> warm, the
// gradient the landing hero and the closing CTA both sit on.
const background = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#EAF4FF"/>
      <stop offset="100%" stop-color="#FFF6F2"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="42%" r="34%">
      <stop offset="0%" stop-color="#7FB3FF" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#7FB3FF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#wash)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
</svg>`)

const wordmark = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <text x="${WIDTH / 2}" y="520" text-anchor="middle"
        font-family="DejaVu Sans" font-size="84" font-weight="bold"
        fill="#111827" letter-spacing="1">Ruah</text>
  <text x="${WIDTH / 2}" y="572" text-anchor="middle"
        font-family="DejaVu Sans" font-size="27" fill="#6B7280"
        letter-spacing="4">ruahruah.com</text>
</svg>`)

// The source art carries roughly 13% transparent margin. Trimming it first is
// why the bear reads at thumbnail size instead of floating in empty space —
// the same correction the favicons needed.
const logo = await sharp(await readFile(join(root, 'public/ruah-logo.png')))
  .trim()
  .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer()

const png = await sharp(background)
  .composite([
    { input: logo, top: 110, left: Math.round((WIDTH - LOGO_SIZE) / 2) },
    { input: wordmark, top: 0, left: 0 },
  ])
  .png()
  .toBuffer()

await writeFile(OUT, png)
const { width, height } = await sharp(png).metadata()
console.log(`wrote ${OUT} — ${width}x${height}, ${(png.length / 1024).toFixed(0)} KB`)
