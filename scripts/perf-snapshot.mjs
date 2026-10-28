/**
 * V1.0 RC — performance snapshot (device-independent metrics + honest caveats).
 * Draw calls / triangles / DPR per level × quality tier, plus a JS-heap
 * drift probe over 40 level transitions.
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright/index.js')

const BASE = process.argv[2] || 'http://localhost:3000'
const browser = await chromium.launch()

async function measure(viewport, tier, label) {
  const page = await browser.newPage({ viewport })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__duck, null, { timeout: 30000 })
  const rows = []
  for (let lv = 0; lv < 5; lv++) {
    const r = await page.evaluate(([lv, tier]) => {
      const D = window.__duck
      D.loadLevel(lv)
      D.setQuality(tier)
      D.sim(30)
      const s = D.state()
      return { level: lv + 1, dc: s.drawCalls, tris: s.triangles, dpr: s.dpr, shadows: s.shadows }
    }, [lv, tier])
    rows.push(r)
  }
  console.log(`${label} [${tier}]: ` + rows.map((r) => `L${r.level} ${r.dc}dc/${(r.tris / 1000).toFixed(1)}k`).join('  '))
  await page.close()
  return rows
}

await measure({ width: 1280, height: 720 }, 'high', 'desktop 720p ')
await measure({ width: 390, height: 844 }, 'balanced', 'mobile 390x844')
await measure({ width: 390, height: 844 }, 'battery', 'mobile 390x844')

// heap drift over 40 transitions
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForFunction(() => !!window.__duck, null, { timeout: 30000 })
const heap0 = (await page.evaluate(() => performance.memory?.usedJSHeapSize ?? -1))
await page.evaluate(() => {
  const D = window.__duck
  for (let i = 0; i < 40; i++) { D.loadLevel(i % 5); D.sim(10) }
})
await page.waitForTimeout(2500)
const heap1 = (await page.evaluate(() => performance.memory?.usedJSHeapSize ?? -1))
console.log(`heap: ${heap0 < 0 ? 'n/a (performance.memory unavailable)' : `${(heap0 / 1048576).toFixed(1)}MB → ${(heap1 / 1048576).toFixed(1)}MB after 40 transitions`}`)
await page.close()

await browser.close()
