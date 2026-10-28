/**
 * V1.0 RC — full player-journey verification (the 12-step spec).
 * Drives the REAL shell (buttons, overlays, storage) via playwright +
 * the window.__duck debug hook for physics-level actions.
 * Swing choreography parameters mirror the proven v6 harness exactly.
 *
 *   node scripts/journey.mjs [http://localhost:3000]
 *
 * Screenshots → download/screens/v10/. Exit 0 iff all steps pass.
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright/index.js')

const BASE = process.argv[2] || 'http://localhost:3000'
const SHOT = 'download/screens/v10'
const results = []
const ok = (step, cond, detail = '') => {
  results.push({ step, ok: !!cond, detail: String(detail) })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${step}  ${detail}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
const shot = (n) => page.screenshot({ path: `${SHOT}/${n}.png` })
const D = () => page.evaluate(() => window.__duck.state())
const clickBtn = (pick) => page.evaluate((pick) => {
  const btns = [...document.querySelectorAll('button')]
  const b = pick.label
    ? btns.find((x) => x.getAttribute('aria-label') === pick.label)
    : btns.find((x) => (x.textContent || '').trim().startsWith(pick.text))
  if (!b) throw new Error('button not found: ' + JSON.stringify(pick))
  b.click()
}, pick)

// Proven-v6 swing choreography, parameterised. Runs INSIDE one evaluate
// (sync, D.sim-driven, RAF-independent). Returns sub-results or throws.
const swingFlight = (fromX, swingX, landMin, landMax, label) => page.evaluate(([fromX, swingX, landMin, landMax, label]) => {
  const D = window.__duck
  const st = () => D.state()
  const simUntil = (fn, maxSteps, what) => {
    let s = st()
    for (let i = 0; i < maxSteps; i++) { D.sim(1); s = st(); if (fn(s)) return s }
    throw new Error(label + ': timeout ' + what + ' last=' + JSON.stringify(s).slice(0, 200))
  }
  D.loadLevel(0)
  D.sim(30)
  // teaching hop over the gap (proven v6 choreography)
  D.press('right', true)
  simUntil((s) => s.x >= 7.4 && s.onGround, 600, 'reach P1 edge')
  D.press('jump', true); D.sim(1); D.press('jump', false)
  simUntil((s) => s.onGround, 500, 'land hop island')
  // grab the swing in range (proven grabInRange form)
  let grabbed = null
  for (let i = 0; i < 400; i++) {
    D.sim(1)
    const s = st()
    if (s.inRange && !s.swinging) {
      D.press('interact', true); D.sim(1); D.press('interact', false)
      grabbed = st()
      break
    }
  }
  if (!grabbed || !grabbed.swinging) throw new Error(label + ': grab missed ' + JSON.stringify(st()).slice(0, 160))
  if (Math.abs(grabbed.x - swingX) > 2.6) throw new Error(label + ': grabbed wrong swing at x=' + grabbed.x)
  // pump to proven omega threshold
  simUntil((s) => Math.abs(s.omega) >= 3.0, 900, 'pump')
  // release in the proven forward window
  D.releaseWhen(2.0, 0.55, 1.0)
  const released = simUntil((s) => !s.swinging, 700, 'release')
  const landed = simUntil((s) => s.onGround, 700, 'land')
  D.press('right', false); D.press('interact', false)
  const inZone = landed.x >= landMin && landed.x <= landMax
  return { releasedVx: +released.vx.toFixed(2), landedX: +landed.x.toFixed(2), inZone, stars: landed.stars, cp: landed.cp }
}, [fromX, swingX, landMin, landMax, label])

// 1 ─ Launch
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__duck, null, { timeout: 30000 })
await sleep(1500)
ok('1 launch', true, 'page loaded, __duck ready')
await shot('01-launch-menu')

// 2 ─ Main menu content
const menuText = await page.evaluate(() => document.body.innerText)
ok('2 menu has PLAY/LEVELS/SETTINGS', /PLAY|CONTINUE/.test(menuText) && /LEVELS/.test(menuText) && /SETTINGS/.test(menuText))

// 3 ─ Enter game (PLAY) → HUD + touch UI
await clickBtn({ text: 'PLAY' })
await page.waitForSelector('button[aria-label="Move left"]', { timeout: 10000 })
await sleep(2000)
const s3 = await D()
ok('3 start level', s3.level === 0 && s3.onGround, `L1 onGround=${s3.onGround}`)
await shot('02-playing')

// 4 ─ Run & jump via REAL touch buttons
const rightBtn = page.locator('button[aria-label="Move right"]')
await rightBtn.dispatchEvent('pointerdown', { pointerId: 7, isPrimary: true, bubbles: true })
await sleep(600)
const sRun = await D()
await page.locator('button[aria-label="Jump"]').dispatchEvent('pointerdown', { pointerId: 8, isPrimary: false, bubbles: true })
await sleep(150)
await page.locator('button[aria-label="Jump"]').dispatchEvent('pointerup', { pointerId: 8, bubbles: true })
await rightBtn.dispatchEvent('pointerup', { pointerId: 7, bubbles: true })
// sample through the whole flight — a single RAF-timed sample can land after the apex
let sAir = { vy: -99 }, sLand = null
for (let i = 0; i < 24; i++) {
  await sleep(100)
  const s = await D()
  if (s.vy > sAir.vy) sAir = s
  if (s.onGround && i > 2) { sLand = s; break }
}
if (!sLand) { await sleep(1200); sLand = await D() }
ok('4 run+jump', sRun.vx > 1 && sAir.vy > 1 && sLand.onGround, `vx=${sRun.vx.toFixed(1)} peakVy=${sAir.vy.toFixed(1)} landed=${sLand.onGround} x=${sLand.x.toFixed(1)}`)

// 8a ─ Collect a star (before any swinging — star 1 sits at the teaching jump)
const starGrab = await page.evaluate(() => {
  const D = window.__duck
  const s0 = D.state().stars
  D.warp(8.8, 1.8); D.sim(8)
  return { got: D.state().stars > s0, stars: D.state().stars }
})
ok('8a collect star', starGrab.got, `stars ${starGrab.stars - (starGrab.got ? 1 : 0)}→${starGrab.stars}`)

// 5-7 ─ Attach → pump → release → land on the wide platform (proven params)
const fl = await swingFlight(0, 11.7, 17.8, 25.8, 'S1')
ok('5 swing attach', true, 'grabbed, pumped to |ω|≥3.0 (proven window)')
ok('6 momentum release', fl.releasedVx > 1.5 || fl.releasedVx < -1.5, `released vx=${fl.releasedVx}`)
ok('7 landed on platform', fl.inZone, `landed x=${fl.landedX} (zone 17.8–25.8), cp=${fl.cp}`)
await shot('03-after-swing')

// 8b ─ Activate checkpoint (walk onto the post at x=21.5)
const cp = await page.evaluate(() => {
  const D = window.__duck
  D.warp(20.2, 1.2); D.sim(10)
  let s = D.state()
  if (s.cp < 0) {
    D.press('right', true)
    for (let i = 0; i < 300 && (D.state().cp < 0 || !D.state().onGround); i++) D.sim(1)
    D.press('right', false); D.sim(10)
    s = D.state()
  }
  return { cp: s.cp, x: +s.x.toFixed(1) }
})
ok('8b checkpoint set', cp.cp >= 0, `cp=${cp.cp} at x=${cp.x}`)

// 9 ─ Fall recovery → respawn at checkpoint
const rec = await page.evaluate(() => {
  const D = window.__duck
  D.press('right', true)
  let s = D.state()
  for (let i = 0; i < 400 && s.onGround; i++) { D.sim(1); s = D.state() }
  D.press('right', false)
  for (let i = 0; i < 600 && !s.onGround; i++) { D.sim(1); s = D.state() }
  return { respawned: s.onGround && s.cp >= 0, x: +s.x.toFixed(1), cp: s.cp }
})
ok('9 fall recovery → checkpoint', rec.respawned, `respawned at x=${rec.x} cp=${rec.cp}`)

// 10 ─ Complete the level: S2 swing → finish island → flag
const wonRes = await page.evaluate(() => {
  const D = window.__duck
  const st = () => D.state()
  const simUntil = (fn, maxSteps, what) => {
    let s = st()
    for (let i = 0; i < maxSteps; i++) { D.sim(1); s = st(); if (fn(s)) return s }
    throw new Error('flag: timeout ' + what + ' last=' + JSON.stringify(s).slice(0, 200))
  }
  D.press('right', true)
  let grabbed2 = null
  for (let i = 0; i < 500; i++) {
    D.sim(1)
    const s = st()
    if (s.inRange && !s.swinging) {
      D.press('interact', true); D.sim(1); D.press('interact', false)
      grabbed2 = st()
      break
    }
  }
  if (!grabbed2 || !grabbed2.swinging) throw new Error('S2 grab missed ' + JSON.stringify(st()).slice(0, 160))
  simUntil((s) => Math.abs(s.omega) >= 3.0, 900, 'pump S2')
  D.releaseWhen(2.0, 0.55, 1.0)
  simUntil((s) => !s.swinging, 700, 'release S2')
  simUntil((s) => s.onGround, 700, 'land P3')
  simUntil((s) => s.won, 600, 'flag')
  D.press('right', false); D.press('interact', false)
  const s = st()
  return { won: s.won, stars: s.stars, x: +s.x.toFixed(1) }
})
ok('10 level complete', wonRes.won, `won at x=${wonRes.x} stars=${wonRes.stars}`)
await sleep(600)
await shot('05-win-overlay')
const winUI = await page.evaluate(() => document.body.innerText)
ok('10 win overlay UI', /NEXT LEVEL/.test(winUI) && /RETRY LEVEL/.test(winUI), 'overlay buttons present')

// 11 ─ NEXT LEVEL → pause → MAIN MENU (no stale state)
await clickBtn({ text: 'NEXT LEVEL' })
await sleep(1500)
const s11 = await D()
ok('11a next level loads', s11.level === 1 && !s11.won, `levelIndex=${s11.level} won=${s11.won}`)
await shot('06-level2')
await clickBtn({ label: 'Pause' })
await sleep(500)
await shot('07-pause')
const pauseText = await page.evaluate(() => document.body.innerText)
ok('11b pause menu', /RESUME/.test(pauseText) && /RESTART LEVEL/.test(pauseText) && /MAIN MENU/.test(pauseText))
await clickBtn({ text: 'MAIN MENU' })
await sleep(1200)
const menu2 = await page.evaluate(() => document.body.innerText)
ok('11c back to menu', /LEVELS/.test(menu2) && !/RESUME/.test(menu2), 'menu rendered, no stale pause overlay')
await shot('08-menu-after-win')

// 12 ─ Close & reopen: progress + settings persist
await clickBtn({ text: 'SETTINGS' })
await sleep(400)
await page.evaluate(() => {
  const sl = document.querySelector('input[aria-label="Sound effects volume"]')
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(sl, '0.3')
  sl.dispatchEvent(new Event('input', { bubbles: true }))
  sl.dispatchEvent(new Event('change', { bubbles: true }))
})
await sleep(400)
await clickBtn({ label: 'Close settings' })
await sleep(300)
const saveRaw = await page.evaluate(() => localStorage.getItem('duck-save-v2'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForFunction(() => !!window.__duck, null, { timeout: 30000 })
await sleep(1200)
const menu3 = await page.evaluate(() => document.body.innerText)
const settingsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('duck-settings-v1') || '{}'))
let saveOk = false
try { saveOk = JSON.parse(saveRaw).unlocked === 2 } catch {}
ok('12a save persists across relaunch', /LEVEL 2/.test(menu3), `menu: ${(menu3.match(/CONTINUE[^\n]*/) || ['no-continue'])[0]}`)
ok('12b settings persist', settingsAfter.sfxVol === 0.3, JSON.stringify(settingsAfter).slice(0, 100))
ok('12c save payload sane', saveOk, saveRaw?.slice(0, 80) || 'null')
await shot('09-relaunch-continue')

// console errors?
ok('no page errors during journey', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean')

console.log(`\n=== JOURNEY: ${results.filter((r) => r.ok).length}/${results.length} steps passed ===`)
require('node:fs').writeFileSync('scripts/journey-report.json', JSON.stringify(results, null, 2))
await browser.close()
process.exit(results.every((r) => r.ok) ? 0 : 1)
