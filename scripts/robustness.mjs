/**
 * V1.0 RC — robustness probes not covered by the sim suites:
 *  - corrupt save → must boot to menu, no crash
 *  - corrupt settings → must boot with defaults, no crash
 *  - every PWA asset (icons, manifest) must return 200
 *  - no unexpected 404/5xx during a fresh boot
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright/index.js')

const BASE = process.argv[2] || 'http://localhost:3000'
const results = []
const ok = (step, cond, detail = '') => {
  results.push({ step, ok: !!cond, detail: String(detail) })
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${step}  ${detail}`)
}

const browser = await chromium.launch()

// ── corrupt save + corrupt settings ──
const page = await browser.newPage()
const bad = []
page.on('pageerror', (e) => bad.push(String(e).slice(0, 150)))
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  localStorage.setItem('duck-save-v2', '{corrupt json!!')
  localStorage.setItem('duck-settings-v1', 'null')
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
const menuTxt = await page.evaluate(() => document.body.innerText)
const hasDuck = await page.evaluate(() => !!window.__duck)
ok('corrupt save → boots to menu, no crash', hasDuck && /LEVELS/.test(menuTxt) && bad.length === 0,
  bad.length ? 'errors: ' + bad.join('|') : 'menu rendered cleanly')
await page.close()

// ── PWA assets all 200 + request log during boot ──
const page2 = await browser.newPage()
const failures = []
page2.on('response', (r) => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`) })
await page2.goto(BASE, { waitUntil: 'networkidle' })
await page2.waitForTimeout(2000)
const assets = ['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/maskable-512.png', '/apple-touch-icon.png']
const codes = {}
for (const a of assets) {
  const res = await page2.request.get(BASE + a)
  codes[a] = res.status()
}
ok('PWA assets all 200', Object.values(codes).every((c) => c === 200), JSON.stringify(codes))
ok('no 4xx/5xx during boot', failures.length === 0, failures.slice(0, 5).join(', ') || 'clean')
await page2.close()

await browser.close()
console.log(`\n=== ROBUSTNESS: ${results.filter((r) => r.ok).length}/${results.length} passed ===`)
process.exit(results.every((r) => r.ok) ? 0 : 1)
