/**
 * Project Duck V2 — L5 "Starlit Hollow" (Region E) test scenarios.
 *
 * INJECT game-tests-v6.js FIRST (it provides window.__T and the base
 * scenarios), then this file: it ADDS l5_* scenarios and T.allV11().
 * Does not require v8/v9 to be present, but is normally run alongside them.
 *
 * New scenarios:
 *   l5_full       — teaching hop, S1 climb (CP1), long vine S2, wisp-zone
 *                    crossing, stepping-stone mover ride, S3→S4 mid-air
 *                    chain (CP2→CP3 across it, safe-route fallback if the
 *                    chain isn't grabbed), S5→S6 finale mid-air chain
 *                    (safe-route catch-isle fallback) → flag
 *   l5_checkpoint — fall after CP2 → respawn there
 *   l5_hazard     — the wisp swarm: standing outside its orbit's x-reach is
 *                    untouched for a full orbit; standing directly under its
 *                    orbit center gets hit (its low point sweeps overhead)
 *                    and respawns at the last checkpoint
 */
;(function () {
  const D = window.__duck
  const T = window.__T
  if (!D || !T) return 'NEED v6 HARNESS FIRST'

  const L5 = 4 // levels.ts index of the 'hollow' level (L1..L4 are 0..3)

  const st = () => D.state()
  const j = (s) => JSON.stringify(s)

  function simUntil(fn, maxSteps, label) {
    let s = st()
    for (let i = 0; i < maxSteps; i++) {
      D.sim(1)
      s = st()
      if (fn(s)) return s
    }
    throw new Error('timeout: ' + label + ' last=' + j(s))
  }

  function grabInRange(maxSteps) {
    for (let i = 0; i < maxSteps; i++) {
      D.sim(1)
      const s = st()
      if (s.inRange && !s.swinging) {
        D.press('interact', true)
        D.sim(1)
        D.press('interact', false)
        return st()
      }
    }
    return null
  }

  function tapJump() {
    D.press('jump', true)
    D.sim(1)
    D.press('jump', false)
  }

  function releaseSwing(minOmega, lo, hi, maxSteps = 900) {
    D.releaseWhen(minOmega, lo, hi)
    return simUntil((s) => !s.swinging, maxSteps, 'release')
  }

  function settleSwings(label) {
    simUntil((q) => q.maxSwingOmega < 0.3, 600, label + ': swings settle')
  }

  // mid-air chain attempt: pump+release already issued; step until either
  // (a) it grabs the NEXT named swing (chain success), (b) it lands
  // on-ground (fallback / safe route), or (c) it falls into the void.
  function flyForChain(targetSwingX, maxSteps) {
    for (let i = 0; i < maxSteps; i++) {
      D.sim(1)
      const s = st()
      if (s.inRange && !s.swinging) {
        D.press('interact', true)
        D.sim(1)
        D.press('interact', false)
        const s2 = st()
        if (s2.swinging && Math.abs(s2.swingX - targetSwingX) < 0.05) {
          return { chained: true, state: s2 }
        }
        if (s2.swinging) {
          // grabbed the wrong (old) swing — let go immediately and keep flying
          D.press('interact', true)
          D.sim(1)
          D.press('interact', false)
        }
      } else if (s.onGround) {
        return { chained: false, state: s }
      } else if (s.y < -2) {
        throw new Error('fell into the void mid-flight: ' + j(s))
      }
    }
    throw new Error('timeout: flyForChain target=' + targetSwingX)
  }

  // ============================ L5 — full traversal ============================

  T.l5_full = function () {
    const log = []
    D.loadLevel(L5)
    D.sim(30)
    settleSwings('l5_full: init')

    // ---- P0 -> teaching hop -> P1 ----
    D.press('right', true)
    simUntil((q) => q.x >= 6.3 && q.onGround, 600, 'reach P0 edge')
    tapJump()
    const hop = simUntil((q) => q.onGround, 500, 'land hop isle')
    if (!(hop.x >= 9.0 && hop.x <= 12.6)) throw new Error('hop landed ' + hop.x.toFixed(2))
    log.push('hop@' + hop.x.toFixed(2))

    // ---- P1 -> S1 (pedestal climb) -> P2 (CP1) ----
    D.press('right', true)
    simUntil((q) => q.x >= 12.2 && q.onGround, 600, 'reach P1 edge')
    tapJump()
    const g1 = grabInRange(300)
    if (!g1 || !g1.swinging) throw new Error('S1 grab missed ' + j(st()))
    simUntil((q) => Math.abs(q.omega) >= 3.0, 900, 'pump S1')
    releaseSwing(3.0, 0.6, 1.0)
    const p2 = simUntil((q) => q.onGround, 700, 'land P2')
    if (!(p2.x >= 18.3 && p2.x <= 26.5)) throw new Error('S1 landed ' + p2.x.toFixed(2))
    log.push('S1->' + p2.x.toFixed(2) + ' cp=' + p2.cp)
    D.press('right', false)
    D.sim(20)
    if (st().cp < 0) throw new Error('CP1 not activated')

    // ---- P2 -> S2 (long vine) -> P3 (wisp zone) ----
    D.press('right', true)
    simUntil((q) => q.x >= 26.0 && q.onGround, 600, 'reach P2 edge')
    tapJump()
    const g2 = grabInRange(300)
    if (!g2 || !g2.swinging) throw new Error('S2 grab missed ' + j(st()))
    simUntil((q) => Math.abs(q.omega) >= 1.9, 900, 'pump S2')
    releaseSwing(1.4, 0.3, 0.6)
    const p3 = simUntil((q) => q.onGround, 700, 'land P3')
    if (!(p3.x >= 32.6 && p3.x <= 41.0)) throw new Error('S2 landed ' + p3.x.toFixed(2))
    log.push('S2->' + p3.x.toFixed(2))
    D.press('right', false)
    D.sim(10)

    // ---- cross P3 (wisp zone) -> wait for the stepping-stone's left
    // extreme -> walk on -> ride -> jump off to P4 (CP2) ----
    D.press('right', true)
    const crossed = simUntil((q) => q.x >= 40.0 && q.onGround, 900, 'cross P3 to edge')
    log.push('crossedP3@' + crossed.x.toFixed(2))
    D.press('right', false)
    simUntil((q) => q.moverX <= 41.55, 900, 'wait for stone left extreme')
    D.press('right', true)
    const onPad = simUntil(
      (q) => q.onGround && q.moverTop <= 0.3 && q.y > 0.5 && Math.abs(q.x - q.moverX) < 1.7,
      600,
      'board the stepping-stone',
    )
    D.press('right', false)
    D.press('left', false)
    log.push('onPad@' + onPad.x.toFixed(2))
    simUntil((q) => q.moverX >= 46.3, 1200, 'ride to right extreme')
    D.press('right', true)
    const edge = simUntil((q) => q.onGround && q.x >= 47.3 && q.vx >= 4.0, 600, 'ride to pad right edge')
    tapJump()
    const p4 = simUntil((q) => q.onGround && q.x >= 50.0, 600, 'jump off to P4')
    D.press('right', false)
    if (!(p4.x >= 50.0 && p4.x <= 54.0)) throw new Error('mover landed ' + p4.x.toFixed(2))
    log.push('edge@' + edge.x.toFixed(2) + ' mover->' + p4.x.toFixed(2) + ' cp=' + p4.cp)
    if (p4.cp < 1) throw new Error('CP2 not activated')

    // ---- P4 -> S3 -> (mid-air chain onto S4, or safe-route catch isle P5) -> P6 (CP3) ----
    D.press('right', true)
    simUntil((q) => q.x >= 53.5 && q.onGround, 600, 'reach P4 edge')
    tapJump()
    const g3 = grabInRange(300)
    if (!g3 || !g3.swinging) throw new Error('S3 grab missed ' + j(st()))
    simUntil((q) => q.omega >= 3.2, 900, 'pump S3 to cap')
    D.releaseWhen(2.6, 0.55, 1.1)
    simUntil((q) => !q.swinging, 900, 'S3 release')
    const chain1 = flyForChain(64.8, 600)
    let afterS3S4
    if (chain1.chained) {
      log.push('MID-AIR CHAIN onto S4 @' + chain1.state.x.toFixed(1))
      simUntil((q) => Math.abs(q.omega) >= 1.9, 900, 'pump S4 (chained)')
      D.releaseWhen(1.4, 0.4, 0.7)
      afterS3S4 = simUntil((q) => q.onGround, 700, 'land after chained S4')
    } else {
      log.push('safe route: landed ' + chain1.state.x.toFixed(1))
      D.press('right', true)
      simUntil((q) => q.x >= 63.8 && q.onGround, 600, 'reach P5 edge')
      tapJump()
      const g4 = grabInRange(300)
      if (!g4 || !g4.swinging) throw new Error('S4 grab missed (safe) ' + j(st()))
      simUntil((q) => Math.abs(q.omega) >= 1.9, 900, 'pump S4 (safe)')
      D.releaseWhen(1.4, 0.4, 0.7)
      afterS3S4 = simUntil((q) => q.onGround, 700, 'land after safe S4')
    }
    D.press('right', false)
    if (!(afterS3S4.x >= 69.0 && afterS3S4.x <= 77.3)) throw new Error('S4 landed ' + afterS3S4.x.toFixed(2))
    log.push('S4->' + afterS3S4.x.toFixed(2) + ' cp=' + afterS3S4.cp)
    if (afterS3S4.cp < 2) throw new Error('CP3 not activated')

    // ---- P6 -> S5 -> (mid-air chain onto S6, or catch isle P7) -> P8 (flag) ----
    D.press('right', true)
    simUntil((q) => q.x >= 76.8 && q.onGround, 600, 'reach P6 edge')
    tapJump()
    const g5 = grabInRange(300)
    if (!g5 || !g5.swinging) throw new Error('S5 grab missed ' + j(st()))
    simUntil((q) => q.omega >= 2.25, 900, 'pump S5')
    D.releaseWhen(1.8, 0.75, 1.1)
    simUntil((q) => !q.swinging, 900, 'S5 release')
    const chain2 = flyForChain(85.6, 600)
    let afterS5S6
    if (chain2.chained) {
      log.push('FINALE CHAIN onto S6 @' + chain2.state.x.toFixed(1))
      simUntil((q) => q.omega >= 3.0, 900, 'pump S6 (chained)')
      D.releaseWhen(2.6, 0.5, 0.95)
      afterS5S6 = simUntil((q) => q.onGround, 700, 'land after chained S6')
    } else {
      if (!(chain2.state.x >= 82.0 && chain2.state.x <= 85.4)) {
        throw new Error('S5 fallback landed outside the catch isle: ' + chain2.state.x.toFixed(2))
      }
      log.push('S5->catch@' + chain2.state.x.toFixed(1))
      D.press('right', true)
      simUntil((q) => q.x >= 84.4 && q.onGround, 600, 'reach P7 edge')
      tapJump()
      const g6 = grabInRange(300)
      if (!g6 || !g6.swinging) throw new Error('S6 grab missed (safe) ' + j(st()))
      simUntil((q) => q.omega >= 3.0, 900, 'pump S6 (safe)')
      D.releaseWhen(2.6, 0.5, 0.95)
      afterS5S6 = simUntil((q) => q.onGround, 700, 'land after safe S6')
    }
    D.press('right', false)
    if (!(afterS5S6.x >= 87.8 && afterS5S6.x <= 98.2)) throw new Error('S6 landed ' + afterS5S6.x.toFixed(2))
    log.push('S6->' + afterS5S6.x.toFixed(2) + ' cp=' + afterS5S6.cp)

    // ---- run to flag ----
    D.press('right', true)
    const won = simUntil((q) => q.won, 900, 'reach flag')
    D.press('right', false)
    log.push('WON x=' + won.x.toFixed(2) + ' stars=' + won.stars + '/8')

    return j({ log, won: won.won, stars: won.stars, x: won.x, cp: won.cp, level: won.level })
  }

  // ============================ checkpoint (post-CP2) ============================

  T.l5_checkpoint = function () {
    D.loadLevel(L5)
    D.sim(30)
    D.warp(52.0, 2.0)
    D.sim(40)
    let s = st()
    if (s.cp < 1) {
      D.press('right', true)
      simUntil((q) => q.x >= 52.0 && q.onGround, 400, 'L5cp: reach post')
      D.press('right', false)
      D.sim(10)
      s = st()
    }
    const cpBefore = s.cp
    if (cpBefore < 1) throw new Error('L5cp: CP2 not active')
    // run off the RIGHT edge of P4 into the gap before S3 -> kill plane
    D.press('right', true)
    simUntil((q) => !q.onGround, 400, 'L5cp: run off edge')
    D.press('right', false)
    simUntil((q) => q.onGround, 600, 'L5cp: respawn+settle')
    s = st()
    return j({
      cpBefore,
      cpAfter: s.cp,
      x: s.x,
      atCheckpoint: s.cp === cpBefore && Math.abs(s.x - 52.0) < 0.7 && s.onGround,
    })
  }

  // ============================ hazard behaviour (wisp swarm) ============================

  T.l5_hazard = function () {
    const r = {}
    D.loadLevel(L5)
    D.sim(30)

    // activate CP1 first (same route as l5_full), so respawn has a defined target
    D.press('right', true)
    simUntil((q) => q.x >= 6.3 && q.onGround, 600, 'hazard: reach P0 edge')
    tapJump()
    simUntil((q) => q.onGround, 500, 'hazard: land hop isle')
    D.press('right', true)
    simUntil((q) => q.x >= 12.2 && q.onGround, 600, 'hazard: reach P1 edge')
    tapJump()
    const g = grabInRange(300)
    if (!g || !g.swinging) throw new Error('hazard: S1 grab missed ' + j(st()))
    simUntil((q) => Math.abs(q.omega) >= 3.0, 900, 'hazard: pump S1')
    releaseSwing(3.0, 0.6, 1.0)
    simUntil((q) => q.onGround, 700, 'hazard: land P2 (CP1)')
    D.press('right', false)
    D.sim(20)
    if (st().cp < 0) throw new Error('hazard: CP1 not active')
    r.cpBefore = st().cp

    // wisp def: x=36.5 radiusX=1.3 radiusY=0.65 speed=1.0 (levels.ts L5.wisps[0])
    const PERIOD = Math.round(((2 * Math.PI) / 1.0) * 60) + 30

    // standing well outside the orbit's x-reach (36.5 +/- 1.3) must be
    // untouched for a full orbit period
    D.warp(33.0, 1.0)
    D.sim(60)
    let touchedSafe = false
    for (let i = 0; i < PERIOD; i++) {
      D.sim(1)
      const s = st()
      if (!s.onGround || s.x < 30) {
        touchedSafe = true
        break
      }
    }
    r.safeStand = !touchedSafe
    if (touchedSafe) throw new Error('hazard: touched while standing clear at x=33.0 ' + j(st()))

    // standing directly under the orbit's center: its low point (y~0.5)
    // sweeps right overhead there, so a hit is guaranteed within one period
    D.warp(36.5, 1.0)
    D.sim(60)
    let hit = false
    for (let i = 0; i < PERIOD; i++) {
      D.sim(1)
      const s = st()
      if (!s.onGround && s.x < 30) {
        hit = true
        break
      }
    }
    if (!hit) throw new Error('hazard: no hit standing under the orbit center for a full period ' + j(st()))
    const s = simUntil((q) => q.onGround, 600, 'hazard: respawn+settle')
    r.hit = true
    r.respawnedAtCP = s.cp === r.cpBefore && Math.abs(s.x - 22.0) < 0.9
    if (!r.respawnedAtCP) throw new Error('hazard: respawn wrong cp=' + s.cp + ' x=' + s.x.toFixed(2))
    return j(r)
  }

  // ============================ extended suite runner ============================

  const L5_NAMES = ['l5_full', 'l5_checkpoint', 'l5_hazard']

  T.allV11 = function () {
    const report = {}
    let pass = 0
    let fail = 0
    for (const n of L5_NAMES) {
      try {
        report[n] = JSON.parse(T[n]())
        report[n].ok = true
        pass++
      } catch (e) {
        report[n] = { ok: false, error: String(e && e.message ? e.message : e) }
        fail++
      }
    }
    report._pass = pass
    report._fail = fail
    return j(report)
  }

  window.__T = T
  return 'v11-harness-ready'
})()
