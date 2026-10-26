/**
 * V1.0 RC — replace Capacitor's stock launcher icons with the Duck icon.
 * Generates mipmap-* ic_launcher / ic_launcher_round / foreground+background.
 */
import sharp from '/home/z/my-project/node_modules/sharp/lib/index.js'
import { mkdirSync } from 'node:fs'

const SRC = '/home/z/my-project/public/icon-512.png'
const MASK = '/home/z/my-project/public/maskable-512.png'
const OUT = '/home/z/my-project/android-build/android/app/src/main/res'
const BG = '#fff2d2'

const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
const fgSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 }

for (const [dpi, s] of Object.entries(sizes)) {
  const dir = `${OUT}/mipmap-${dpi}`
  mkdirSync(dir, { recursive: true })
  await sharp(SRC).resize(s, s).png().toFile(`${dir}/ic_launcher.png`)
  await sharp(SRC).resize(s, s).composite([{
    input: Buffer.from(`<svg width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="${BG}"/></svg>`),
    blend: 'dest-in',
  }]).png().toFile(`${dir}/ic_launcher_round.png`)
}
for (const [dpi, s] of Object.entries(fgSizes)) {
  const dir = `${OUT}/mipmap-${dpi}`
  mkdirSync(dir, { recursive: true })
  // foreground must be ~66% of canvas: maskable icon is already padded, scale to fit
  await sharp(MASK).resize(s, s).png().toFile(`${dir}/ic_launcher_foreground.png`)
  await sharp({ create: { width: s, height: s, channels: 4, background: BG } }).png().toFile(`${dir}/ic_launcher_background.png`)
}
console.log('duck launcher icons generated')
