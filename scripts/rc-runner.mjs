/**
 * V1.0 RC — regression runner.
 * Replicates the canonical V0.8 (14 scenarios) + V0.9 (6 scenarios) suites
 * against the live game, using global playwright (no CLI eval timeout limits).
 *
 *   node scripts/rc-runner.mjs [http://localhost:3000]
 *
 * Exit code 0 iff every scenario passes. Prints a JSON summary at the end.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright/index.js')

const BASE = process.argv[2] || 'http://localhost:3000'
const V8 = [
  'l1_full', 'l1_checkpoint', 'l2_full', 'l2_chain', 'l3_movers', 'l3_checkpoint',
  'l3_full', 'crossLevel4', 'resetLoop', 'l4_part1', 'l4_full', 'l4_hazard',
  'l4_checkpoint', 'l4_shortcut',
]
const V9 = ['v9_pauseSwing', 'v9_pauseRespawn', 'v9_quality', 'v9_levelLoop', 'v9_multiTouch', 'v9_hudPrompt']
const V11 = ['l5_full', 'l5_checkpoint', 'l5_hazard']

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
const page = await ctx.newPage()

const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)) })
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 300)))

console.log('open', BASE)
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__duck, null, { timeout: 30000 })

for (const f of ['scripts/game-tests-v6.js', 'scripts/game-tests-v8.js', 'scripts/game-tests-v9.js', 'scripts/game-tests-v11.js']) {
  await page.addScriptTag({ content: readFileSync(f, 'utf8') })
}
console.log('harness injected:',
  await page.evaluate(() => typeof window.__duck + '/' + typeof window.__T))

const report = { v8: {}, v9: {}, v11: {}, consoleErrors }

async function runSuite(kind, names) {
  for (const n of names) {
    const t0 = Date.now()
    try {
      // each scenario is synchronous + step-bounded internally; evaluate has no timeout
      const raw = await page.evaluate((name) => window.__T[name](), n)
      const parsed = JSON.parse(raw)
      const ok = kind === 'v8' ? parsed._ok !== false : parsed.ok !== false
      report[kind][n] = { ok, ms: Date.now() - t0, detail: parsed }
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${kind}/${n}  (${Date.now() - t0}ms)`)
      if (!ok) console.log('      ', raw.slice(0, 400))
    } catch (e) {
      report[kind][n] = { ok: false, ms: Date.now() - t0, error: String(e).slice(0, 400) }
      console.log(`FAIL  ${kind}/${n}  (${Date.now() - t0}ms)  ${String(e).slice(0, 200)}`)
    }
  }
}

await runSuite('v8', V8)

// v9_multiTouch exercises the REAL shell touch buttons, which only exist on
// the playing screen. Put the shell there via the actual menu button (as a
// user would) instead of relying on scenario ordering.
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /^(PLAY|CONTINUE)/.test(b.textContent.trim()))
  if (!btn) throw new Error('menu PLAY button not found')
  btn.click()
})
await page.waitForSelector('button[aria-label="Move left"]', { timeout: 10000 })
console.log('shell: playing screen active')

await runSuite('v9', V9)
await runSuite('v11', V11)

const p8 = V8.filter((n) => report.v8[n]?.ok).length
const p9 = V9.filter((n) => report.v9[n]?.ok).length
const p11 = V11.filter((n) => report.v11[n]?.ok).length
console.log(
  `\n=== SUITE: ${p8}/${V8.length} v8  +  ${p9}/${V9.length} v9  +  ${p11}/${V11.length} v11  =  ` +
    `${p8 + p9 + p11}/${V8.length + V9.length + V11.length} ===`,
)
if (consoleErrors.length) {
  console.log('console errors during run:', consoleErrors.length)
  console.log([...new Set(consoleErrors)].slice(0, 10).join('\n'))
}
require('node:fs').writeFileSync('scripts/rc-report.json', JSON.stringify(report, null, 2))
await browser.close()
process.exit(
  p8 + p9 + p11 === V8.length + V9.length + V11.length && consoleErrors.length === 0 ? 0 : 1,
)
