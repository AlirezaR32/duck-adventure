/**
 * V0.9 — generates the PWA/Android launcher icons from an inline SVG of the
 * duck mascot (matches the game's palette). Run: bun scripts/gen-icons.mjs
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const OUT = '/home/z/my-project/public'
mkdirSync(OUT, { recursive: true })

// friendly duck on a warm amber disc — flat, readable at 48px
const duckSvg = (pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd47e"/>
      <stop offset="1" stop-color="#ffb340"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${pad > 0 ? 512 : 112}" fill="url(#bg)"/>
  <g transform="translate(256 272) scale(${(392 - pad * 2) / 392}) translate(-256 -272)">
    <!-- body -->
    <ellipse cx="256" cy="300" rx="128" ry="98" fill="#fffdf6"/>
    <!-- tail flick -->
    <path d="M 372 268 q 34 -14 40 -44 q 10 40 -24 62 z" fill="#fffdf6"/>
    <!-- head -->
    <circle cx="196" cy="176" r="86" fill="#fffdf6"/>
    <!-- neck join -->
    <path d="M 150 216 q 10 46 44 58 l 46 -18 q -52 -6 -66 -58 z" fill="#fffdf6"/>
    <!-- beak -->
    <path d="M 118 186 q -52 -6 -64 12 q 30 26 66 22 q 16 -14 -2 -34 z" fill="#ff9d2e"/>
    <path d="M 118 206 q -30 2 -52 -6 q 26 20 54 18 z" fill="#e8821a"/>
    <!-- eye -->
    <circle cx="196" cy="158" r="13" fill="#2b2420"/>
    <circle cx="200" cy="153" r="4.5" fill="#ffffff"/>
    <!-- wing -->
    <path d="M 262 274 q 74 -10 96 34 q -20 40 -78 32 q -46 -8 -42 -36 q 2 -24 24 -30 z" fill="#f4e8cf"/>
    <!-- belly -->
    <ellipse cx="238" cy="368" rx="66" ry="22" fill="#f7efdb"/>
  </g>
</svg>`

const jobs = [
  ['icon-512.png', duckSvg(0)],
  ['icon-192.png', duckSvg(0)],
  // maskable: art must survive a circular crop — keep the duck inside the
  // inner 80% safe zone on a full-bleed background
  ['maskable-512.png', duckSvg(52)],
  ['apple-touch-icon.png', duckSvg(0)],
]

for (const [name, svg] of jobs) {
  const size = name.includes('192') ? 192 : name.includes('apple') ? 180 : 512
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`${OUT}/${name}`)
  console.log('wrote', `${OUT}/${name}`, size + 'x' + size)
}
