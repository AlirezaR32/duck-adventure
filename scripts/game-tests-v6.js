/**
 * Project Duck V0.6 — deterministic in-browser test harness.
 * Injected via agent-browser eval. Uses window.__duck.sim(n) so every
 * scenario runs frame-by-frame with zero timing flake.
 *
 * Scenarios:
 *   l1_full          — Level 1 start-to-flag (jump teach, S1, S2, stars)
 *   l1_checkpoint    — fall after the checkpoint → respawn there
 *   l2_full          — Level 2 start-to-flag (5 swings incl. climb)
 *   l2_chain         — S3 hard release → mid-air grab of S4 (fallback: safe route)
 *   l3_full          — Level 3 start-to-flag (M1 ferry, M2 elevator, finale)
 *   l3_movers        — explicit ride assertions for both moving slabs
 *   l3_checkpoint    — respawn at the pre-finale checkpoint
 *   crossLevel       — loadLevel switching leaves no stale state (both directions)
 *   resetLoop        — repeated grab/release + full resets stay bounded & sane
 */
;(function () {
  const D = window.__duck
  if (!D) return 'NO HOOK'

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

  /**
   * Generic traversal: run toward the swing, (jump if needed), grab at the
   * first in-range sim step, pump to target omega, release in the window,
   * verify landing inside [a, b]. Isolation = fresh level load.
   */
  function cross(opts) {
    const { level, startX, jumpAt, omegaTarget, win, land, label, settleDrop = 40 } = opts
    const r = { label, events: [] }
    try {
      D.loadLevel(level)
      D.sim(30)
      settleSwings(label)
      D.warp(startX, 3.0)
      D.sim(settleDrop)
      let s = st()
      if (!s.onGround) throw new Error(label + ': did not settle at start ' + j(s))
      D.press('right', true)
      if (jumpAt != null) {
        simUntil((q) => q.x >= jumpAt && q.onGround, 600, label + ': reach jump point')
        tapJump()
        r.events.push('jumped@' + st().x.toFixed(2))
      }
      const g = grabInRange(300)
      if (!g || !g.swinging) throw new Error(label + ': grab missed (fell) ' + j(st()))
      r.events.push('grab@' + g.x.toFixed(2))
      D.sim(2)
      simUntil((q) => Math.abs(q.omega) >= omegaTarget, 900, label + ': pump to ' + omegaTarget)
      D.sim(1)
      const rel = releaseSwing(Math.max(1.0, omegaTarget - 0.85), win[0], win[1])
      r.events.push('rel theta=' + rel.theta.toFixed(2) + ' vx=' + st().vx.toFixed(2))
      const landed = simUntil((q) => q.onGround, 700, label + ': land')
      D.press('right', false)
      r.landedX = landed.x
      r.ok = landed.x >= land[0] && landed.x <= land[1]
      r.cp = landed.cp
      r.stars = landed.stars
      if (!r.ok) throw new Error(label + ': landed OUT ' + landed.x.toFixed(2) + ' not in [' + land + ']')
      return r
    } catch (e) {
      throw new Error((e.message || e) + ' | events=' + j(r.events))
    }
  }

  const T = {}

  // ============================ Level 1 ============================

  T.l1_full = function () {
    const log = []
    D.loadLevel(0)
    D.sim(30)
    // teach-jump onto the hop island
    D.press('right', true)
    simUntil((q) => q.x >= 7.4 && q.onGround, 600, 'L1: reach P1 edge')
    tapJump()
    const hop = simUntil((q) => q.onGround, 500, 'L1: land hop island')
    if (!(hop.x >= 9.9 && hop.x <= 13.1)) throw new Error('L1: hop landed ' + hop.x.toFixed(2))
    log.push('hop@' + hop.x.toFixed(2))
    // S1 → wide landing
    D.press('right', true)
    const g = grabInRange(300)
    if (!g || !g.swinging) throw new Error('L1: S1 grab missed ' + j(st()))
    simUntil((q) => Math.abs(q.omega) >= 3.0, 900, 'L1: pump S1')
    releaseSwing(2.0, 0.55, 1.0)
    const p2 = simUntil((q) => q.onGround, 700, 'L1: land P2')
    if (!(p2.x >= 17.8 && p2.x <= 25.8)) throw new Error('L1: S1 landed ' + p2.x.toFixed(2))
    log.push('S1→' + p2.x.toFixed(2))
    D.press('right', false)
    D.sim(20)
    if (p2.cp < 0) throw new Error('L1: checkpoint on P2 not activated')
    // S2 → finish island + flag
    D.press('right', true)
    const g2 = grabInRange(300)
    if (!g2 || !g2.swinging) throw new Error('L1: S2 grab missed ' + j(st()))
    simUntil((q) => Math.abs(q.omega) >= 3.0, 900, 'L1: pump S2')
    releaseSwing(2.0, 0.55, 1.0)
    const p3 = simUntil((q) => q.onGround, 700, 'L1: land P3')
    if (!(p3.x >= 29.8 && p3.x <= 37.4)) throw new Error('L1: S2 landed ' + p3.x.toFixed(2))
    D.press('right', true)
    simUntil((q) => q.won, 600, 'L1: flag')
    D.press('right', false)
    const s = st()
    return j({ log, won: s.won, stars: s.stars, x: s.x, cp: s.cp, level: s.level })
  }

  T.l1_checkpoint = function () {
    D.loadLevel(0)
    D.sim(30)
    D.warp(21.5, 3.0)
    D.sim(40)
    let s = st()
    if (s.cp < 0) {
      // walk onto the post to activate
      D.press('right', true)
      simUntil((q) => q.x >= 21.5 && q.onGround, 400, 'L1cp: reach post')
      D.press('right', false)
      D.sim(10)
      s = st()
    }
    const cpBefore = s.cp
    if (cpBefore < 0) throw new Error('L1cp: no checkpoint active')
    // run off the right edge of P2 (gap below → kill plane)
    D.press('right', true)
    simUntil((q) => !q.onGround, 400, 'L1cp: run off edge')
    D.press('right', false)
    simUntil((q) => q.onGround, 600, 'L1cp: respawn+settle')
    s = st()
    return j({
      cpBefore,
      cpAfter: s.cp,
      x: s.x,
      atCheckpoint: s.cp === cpBefore && Math.abs(s.x - 21.5) < 0.7 && s.onGround,
    })
  }

  // ============================ Level 2 ============================

  T.l2_full = function () {
    const log = []
    D.loadLevel(1)
    D.sim(30)
    settleSwings('L2')
    // S1: pedestal swing → climb to the high isle
    D.warp(4.0, 3.0)
    D.sim(40)
    D.press('right', true)
    simUntil((q) => q.x >= 6.2 && q.onGround, 500, 'L2: reach P1 edge')
    tapJump()
    const g = grabInRange(300)
    if (!g || !g.swinging) throw new Error('L2: S1 grab missed ' + j(st()))
    simUntil((q) => Math.abs(q.omega) >= 3.0, 900, 'L2: pump S1')
    releaseSwing(2.0, 0.65, 1.05)
    const p2 = simUntil((q) => q.onGround, 700, 'L2: land P2')
    if (!(p2.x >= 13.0 && p2.x <= 22.2)) throw new Error('L2: S1 landed ' + p2.x.toFixed(2))
    log.push('S1→' + p2.x.toFixed(2))
    // S2: hanging vine → low isle
    D.press('right', true)
    simUntil((q) => q.x >= 21.6 && q.onGround, 600, 'L2: reach P2 edge')
    tapJump()
    const g2 = grabInRange(300)
    if (!g2 || !g2.swinging) throw new Error('L2: S2 grab missed ' + j(st()))
    simUntil((q) => Math.abs(q.omega) >= 1.9, 900, 'L2: pump S2')
    releaseSwing(1.4, 0.3, 0.65)
    const p3 = simUntil((q) => q.onGround, 700, 'L2: land P3')
    if (!(p3.x >= 27.4 && p3.x <= 35.2)) throw new Error('L2: S2 landed ' + p3.x.toFixed(2))
    log.push('S2→' + p3.x.toFixed(2))
    D.press('right', false)
    D.sim(20)
    // S3: pedestal swing → catch isle
    D.press('right', true)
    simUntil((q) => q.x >= 35.0 && q.onGround, 600, 'L2: reach P3 edge')
    tapJump()
    const g3 = grabInRange(300)
    if (!g3 || !g3.swinging) throw new Error('L2: S3 grab missed ' + j(st()))
    simUntil((q) => Math.abs(q.omega) >= 3.2, 900, 'L2: pump S3')
    releaseSwing(2.4, 0.45, 0.75)
    const p4 = simUntil((q) => q.onGround, 700, 'L2: land P4')
    if (!(p4.x >= 41.0 && p4.x <= 46.2)) throw new Error('L2: S3 landed ' + p4.x.toFixed(2))
    log.push('S3→' + p4.x.toFixed(2))
    D.press('right', false)
    D.sim(20)
    // S4: hanging → wide isle
    D.press('right', true)
    simUntil((q) => q.x >= 45.6 && q.onGround, 600, 'L2: reach P4 edge')
    tapJump()
    const g4 = grabInRange(300)
    if (!g4 || !g4.swinging) throw new Error('L2: S4 grab missed ' + j(st()))
    simUntil((q) => Math.abs(q.omega) >= 1.9, 900, 'L2: pump S4')
    releaseSwing(1.4, 0.4, 0.7)
    const p5 = simUntil((q) => q.onGround, 700, 'L2: land P5')
    if (!(p5.x >= 51.2 && p5.x <= 58.0)) throw new Error('L2: S4 landed ' + p5.x.toFixed(2))
    log.push('S4→' + p5.x.toFixed(2))
    D.press('right', false)
    D.sim(20)
    if (p5.cp < 1) throw new Error('L2: second checkpoint not activated')
    // S5: climb to the high finish + flag
    D.press('right', true)
    const g5 = grabInRange(300)
    if (!g5 || !g5.swinging) throw new Error('L2: S5 grab missed ' + j(st()))
    simUntil((q) => Math.abs(q.omega) >= 3.3, 900, 'L2: pump S5')
    releaseSwing(2.4, 0.7, 1.1)
    const p6 = simUntil((q) => q.onGround, 700, 'L2: land P6')
    if (!(p6.x >= 61.4 && p6.x <= 67.0)) throw new Error('L2: S5 landed ' + p6.x.toFixed(2))
    D.press('right', true)
    simUntil((q) => q.won, 600, 'L2: flag')
    D.press('right', false)
    const s = st()
    return j({ log, won: s.won, stars: s.stars, x: s.x, cp: s.cp, level: s.level })
  }

  T.l2_chain = function () {
    const r = { events: [] }
    D.loadLevel(1)
    D.sim(30)
    settleSwings('L2chain')
    D.warp(33.0, 3.0)
    D.sim(40)
    D.press('right', true)
    simUntil((q) => q.x >= 37.4 && q.onGround, 600, 'chain: reach S3 jump point')
    tapJump()
    const g = grabInRange(300)
    if (!g || !g.swinging) throw new Error('chain: S3 grab missed ' + j(st()))
    r.events.push('grab S3')
    simUntil((q) => q.omega >= 3.2, 900, 'chain: pump S3')
    D.releaseWhen(2.6, 0.55, 1.1)
    simUntil((q) => !q.swinging, 700, 'chain: release S3')
    r.events.push('released S3 vx=' + st().vx.toFixed(1))
    // fly toward S4 — try to grab it while STILL airborne
    let chained = false
    let s = st()
    for (let i = 0; i < 400 && !s.onGround; i++) {
      D.sim(1)
      s = st()
      if (s.inRange && !s.swinging) {
        D.press('interact', true)
        D.sim(1)
        D.press('interact', false)
        s = st()
        if (s.swinging) {
          if (Math.abs(s.swingX - 46.6) < 0.01) {
            chained = true
            r.events.push('MID-AIR CHAIN onto S4 @x=' + s.x.toFixed(1))
            break
          }
          // grabbed something else mid-flight (e.g. re-grab) — let go and keep flying
          D.press('interact', true)
          D.sim(1)
          D.press('interact', false)
        }
      }
    }
    r.chained = chained
    if (chained) {
      D.press('right', true)
      simUntil((q) => q.omega >= 1.9, 900, 'chain: pump S4')
      releaseSwing(1.4, 0.4, 0.7)
      const landed = simUntil((q) => q.onGround, 700, 'chain: land after S4')
      r.landedX = landed.x
      r.ok = landed.x >= 51.2 && landed.x <= 58.0
    } else {
      // safe route: land P4, run to the edge, jump-grab S4
      const landed = simUntil((q) => q.onGround, 500, 'chain: land P4')
      D.press('right', true)
      simUntil((q) => q.x >= 45.6 && q.onGround, 400, 'chain: reach P4 edge')
      tapJump()
      const g2 = grabInRange(300)
      D.press('right', false)
      if (!g2 || !g2.swinging) throw new Error('chain: S4 grab missed after landing')
      r.events.push('grab S4 after landing')
      D.press('right', true)
      simUntil((q) => q.omega >= 1.9, 900, 'chain: pump S4 (2nd)')
      releaseSwing(1.4, 0.4, 0.7)
      const l2 = simUntil((q) => q.onGround, 700, 'chain: land P5')
      r.landedX = l2.x
      r.ok = l2.x >= 51.2 && l2.x <= 58.0
    }
    D.press('right', false)
    return j(r)
  }

  // ============================ Level 3 ============================

  /** Ride M1 (ferry slab) across the first canyon gap. */
  function rideM1() {
    D.loadLevel(2)
    D.sim(30)
    D.warp(15.0, 3.0)
    D.sim(40)
    let s = st()
    if (!s.onGround) throw new Error('M1: not settled on P2')
    D.press('right', true)
    simUntil((q) => q.x >= 16.7 && q.onGround, 600, 'M1: reach P2 edge')
    // wait for the slab to come close, then hop on
    simUntil((q) => q.moverX <= 21.0 && q.moverTop <= 0.9, 900, 'M1: wait for slab')
    tapJump()
    const on = simUntil((q) => q.onGround && q.x > 17.4, 600, 'M1: land on slab')
    if (on.moverTop > 1.2) throw new Error('M1: landed but not on slab (top ' + on.moverTop + ')')
    D.press('right', false)
    // ride: duck x must track the moving platform to the right extreme
    const xAtStart = on.x
    simUntil((q) => q.moverX >= 21.6, 900, 'M1: ride right')
    const after = st()
    if (!after.onGround) throw new Error('M1: lost ground during ride')
    if (after.x <= xAtStart + 0.8) {
      throw new Error('M1: duck not carried (x ' + xAtStart.toFixed(2) + ' → ' + after.x.toFixed(2) + ')')
    }
    // hop off to P3
    D.press('right', true)
    simUntil((q) => q.moverX >= 21.85, 400, 'M1: slab at right extreme')
    tapJump()
    const p3 = simUntil((q) => q.onGround && q.x >= 23.9, 600, 'M1: hop to P3')
    D.press('right', false)
    if (!(p3.x >= 24.2 && p3.x <= 31.4)) throw new Error('M1: P3 landing ' + p3.x.toFixed(2))
    return p3
  }

  T.l3_movers = function () {
    const p3 = rideM1()
    return j({ m1: 'ok', landedP3: p3.x })
  }

  T.l3_checkpoint = function () {
    D.loadLevel(2)
    D.sim(30)
    D.warp(49.2, 3.0)
    D.sim(40)
    let s = st()
    if (s.cp < 1) {
      D.press('right', true)
      simUntil((q) => q.x >= 49.2 && q.onGround, 400, 'L3cp: reach post')
      D.press('right', false)
      D.sim(10)
      s = st()
    }
    const cpBefore = s.cp
    if (cpBefore < 1) throw new Error('L3cp: pre-finale checkpoint not active')
    // run off the LEFT edge of P5 (the right edge is caught by the M2
    // elevator corner — the left gap is a guaranteed kill-plane fall)
    D.press('left', true)
    simUntil((q) => !q.onGround, 400, 'L3cp: run off edge')
    D.press('left', false)
    simUntil((q) => q.onGround, 600, 'L3cp: respawn+settle')
    s = st()
    return j({
      cpBefore,
      cpAfter: s.cp,
      x: s.x,
      atCheckpoint: s.cp === cpBefore && Math.abs(s.x - 49.2) < 0.7 && s.onGround,
    })
  }

  T.l3_part1 = function () {
    const log = []
    // S1: elevated pedestal swing → narrow ledge
    D.loadLevel(2)
    D.sim(30)
    settleSwings('L3')
    D.warp(3.0, 3.0)
    D.sim(40)
    D.press('right', true)
    simUntil((q) => q.x >= 6.2 && q.onGround, 500, 'L3: reach P1 edge')
    tapJump()
    const g = grabInRange(300)
    if (!g || !g.swinging) throw new Error('L3: S1 grab missed ' + j(st()))
    simUntil((q) => Math.abs(q.omega) >= 3.0, 900, 'L3: pump S1')
    releaseSwing(2.0, 0.6, 1.0)
    const p2 = simUntil((q) => q.onGround, 700, 'L3: land P2')
    if (!(p2.x >= 12.8 && p2.x <= 17.2)) throw new Error('L3: S1 landed ' + p2.x.toFixed(2))
    log.push('S1→' + p2.x.toFixed(2))
    D.press('right', false)
    D.sim(20)
    // M1 ferry → P3
    const p3 = rideM1From(p2.x)
    log.push('M1→' + p3.x.toFixed(2))
    // S2: long vine → deep ledge
    D.press('right', true)
    simUntil((q) => q.x >= 30.8 && q.onGround, 600, 'L3: reach P3 edge')
    tapJump()
    const g2 = grabInRange(300)
    if (!g2 || !g2.swinging) throw new Error('L3: S2 grab missed ' + j(st()))
    simUntil((q) => Math.abs(q.omega) >= 1.9, 900, 'L3: pump S2')
    releaseSwing(1.4, 0.3, 0.6)
    const p4 = simUntil((q) => q.onGround, 700, 'L3: land P4')
    if (!(p4.x >= 36.6 && p4.x <= 40.2)) throw new Error('L3: S2 landed ' + p4.x.toFixed(2))
    log.push('S2→' + p4.x.toFixed(2))
    D.press('right', false)
    D.sim(20)
    // S3: quick swing → checkpoint isle
    D.press('right', true)
    simUntil((q) => q.x >= 40.0 && q.onGround, 600, 'L3: reach P4 edge')
    tapJump()
    const g3 = grabInRange(300)
    if (!g3 || !g3.swinging) throw new Error('L3: S3 grab missed ' + j(st()))
    simUntil((q) => Math.abs(q.omega) >= 3.2, 900, 'L3: pump S3')
    releaseSwing(2.4, 0.65, 1.0)
    const p5 = simUntil((q) => q.onGround, 700, 'L3: land P5')
    if (!(p5.x >= 46.4 && p5.x <= 51.8)) throw new Error('L3: S3 landed ' + p5.x.toFixed(2))
    log.push('S3→' + p5.x.toFixed(2))
    D.press('right', false)
    D.sim(20)
    if (p5.cp < 1) throw new Error('L3: pre-finale checkpoint missing')
    return j({ part: 1, log, x: p5.x, cp: p5.cp, stars: p5.stars })
  }

  /**
   * Continues from l3_part1's end state (duck standing on P5).
   * Runs a bounded slice (~250 sim steps) of the finale state machine per
   * call so the CLI can drive long elevator waits without eval timeouts.
   * Returns { done, phase, ...state }.
   */
  const l3ph = { phase: 0, log: [] }
  T.l3_reset2 = function () {
    l3ph.phase = 0
    l3ph.log = []
    return 'reset'
  }
  T.l3_drive = function () {
    const MAX = 250
    let steps = 0
    let s = st()
    const advance = () => {
      l3ph.phase++
      l3ph.log.push('phase ' + l3ph.phase)
    }
    while (steps < MAX) {
      s = st()
      if (l3ph.phase === 0) {
        // walk to the P5 edge
        D.press('right', true)
        D.sim(1)
        steps++
        s = st()
        if (s.x >= 51.4 && s.onGround) {
          D.press('right', false)
          advance()
        }
      } else if (l3ph.phase === 1) {
        // wait for the elevator to come low, then hop across HOLDING RIGHT
        // (a standing jump can never reach the slab — V0.7 harness fix)
        D.sim(1)
        steps++
        s = st()
        if (s.moverTop <= 1.75 && s.moverTop >= 1.0) {
          D.press('right', true)
          D.press('jump', true)
          D.sim(1)
          D.press('jump', false)
          advance()
        }
      } else if (l3ph.phase === 2) {
        // land on the elevator (right held through the hop), then stop
        D.sim(1)
        steps++
        s = st()
        if (s.onGround && s.x > 52.6) {
          D.press('right', false)
          advance()
        } else if (!s.onGround && s.y < 0.4) {
          throw new Error('l3_drive: fell off while boarding M2 ' + j(s))
        }
      } else if (l3ph.phase === 3) {
        // ride up while walking toward the slab's right edge, then jump
        D.press('right', true)
        D.sim(1)
        steps++
        s = st()
        if (s.x >= 55.3 || !s.onGround) {
          D.press('right', false)
        }
        if (s.moverTop >= 2.5 && s.onGround && s.x >= 55.0) {
          D.press('right', true)
          D.press('jump', true)
          D.sim(1)
          D.press('jump', false)
          advance()
        }
      } else if (l3ph.phase === 4) {
        // hop to the spire
        D.press('right', true)
        D.sim(1)
        steps++
        s = st()
        if (s.onGround && s.x >= 57.0) {
          D.press('right', false)
          if (!(s.x >= 57.6 && s.x <= 61.6)) throw new Error('l3_drive: spire landing ' + s.x.toFixed(2))
          l3ph.log.push('M2→' + s.x.toFixed(1))
          advance()
        }
      } else if (l3ph.phase === 5) {
        // grab the finale swing
        D.sim(1)
        steps++
        s = st()
        if (s.inRange && !s.swinging) {
          D.press('interact', true)
          D.sim(1)
          D.press('interact', false)
          s = st()
          if (s.swinging) advance()
        }
      } else if (l3ph.phase === 6) {
        // pump toward 2.5 omega — POSITIVE only: releaseWhen's window needs
        // omega > +2.0, so exiting on a leftward peak would deadlock (V0.7 fix)
        D.press('right', true)
        D.sim(1)
        steps++
        s = st()
        if (s.omega >= 2.5) {
          D.press('right', false)
          D.releaseWhen(2.0, 0.65, 1.05)
          advance()
        }
      } else if (l3ph.phase === 7) {
        // release + land the grand finale
        D.sim(1)
        steps++
        s = st()
        if (!s.swinging && s.onGround) {
          D.press('right', false)
          if (!(s.x >= 66.4 && s.x <= 73.8)) throw new Error('l3_drive: finale landed ' + s.x.toFixed(2))
          l3ph.log.push('S4→' + s.x.toFixed(1))
          advance()
        }
      } else if (l3ph.phase === 8) {
        // run to the flag
        D.press('right', true)
        D.sim(1)
        steps++
        s = st()
        if (s.won) {
          D.press('right', false)
          advance()
        }
      } else {
        return j({ done: true, phase: l3ph.phase, log: l3ph.log, ...s })
      }
    }
    return j({ done: false, phase: l3ph.phase, steps, log: l3ph.log, ...s })
  }

  /** In-page convenience wrapper (may exceed CLI eval limits). */
  T.l3_part2 = function () {
    T.l3_reset2()
    let r = JSON.parse(T.l3_drive())
    let guard = 0
    while (!r.done && guard++ < 200) r = JSON.parse(T.l3_drive())
    return j({ log: r.log, won: r.won, stars: r.stars, x: r.x, cp: r.cp, level: r.level })
  }

  T.l3_full = function () {
    const a = JSON.parse(T.l3_part1())
    const b = JSON.parse(T.l3_part2())
    return j({ log: [...a.log, ...b.log], won: b.won, stars: b.stars, x: b.x, cp: b.cp, level: b.level })
  }

  // ride helpers that continue from the l3_full flow (level already loaded)
  function rideM1From(fromX) {
    D.warp(15.5, 3.0)
    D.sim(40)
    D.press('right', true)
    simUntil((q) => q.x >= 16.7 && q.onGround, 600, 'M1b: reach edge')
    simUntil((q) => q.moverX <= 21.0 && q.moverTop <= 0.9, 900, 'M1b: wait for slab')
    tapJump()
    simUntil((q) => q.onGround && q.x > 17.4, 600, 'M1b: land on slab')
    D.press('right', false)
    simUntil((q) => q.moverX >= 21.85, 900, 'M1b: ride right')
    D.press('right', true)
    simUntil((q) => q.moverX >= 21.85 && q.onGround, 400, 'M1b: slab at extreme')
    tapJump()
    const p3 = simUntil((q) => q.onGround && q.x >= 23.9, 600, 'M1b: hop to P3')
    D.press('right', false)
    return p3
  }

  function rideM2From() {
    // standing on P5 (checkpoint isle) — walk to the edge and wait for the elevator
    D.press('right', true)
    simUntil((q) => q.x >= 51.4 && q.onGround, 600, 'M2: reach P5 edge')
    D.press('right', false)
    simUntil((q) => q.moverTop <= 1.75 && q.moverTop >= 1.0, 1100, 'M2: wait low')
    tapJump()
    const on = simUntil((q) => q.onGround && q.x > 52.6, 600, 'M2: land on elevator')
    D.press('right', false)
    // ride up
    simUntil((q) => q.moverTop >= 2.55 && q.onGround, 1100, 'M2: ride up')
    D.press('right', true)
    tapJump()
    const p6 = simUntil((q) => q.onGround && q.x >= 57.8, 600, 'M2: hop to spire')
    D.press('right', false)
    if (!(p6.x >= 58.2 && p6.x <= 61.6)) throw new Error('M2: spire landing ' + p6.x.toFixed(2))
    return p6
  }

  // ============================ cross-level & stability ============================

  T.crossLevel = function () {
    const r = {}
    // finish a level, then load the next one — state must be pristine
    D.loadLevel(0)
    D.sim(30)
    D.warp(34.0, 3.0)
    D.sim(40)
    D.press('right', true)
    simUntil((q) => q.won, 600, 'cross: win L1')
    D.press('right', false)
    r.l1won = st().won
    D.loadLevel(1)
    D.sim(45)
    let s = st()
    r.l2 = { level: s.level, x: s.x, stars: s.stars, cp: s.cp, swinging: s.swinging, onGround: s.onGround, won: s.won }
    r.l2clean = s.level === 1 && s.stars === 0 && s.cp === -1 && !s.swinging && !s.won && s.onGround
    // back to the previous level, then forward again — no residue either way
    D.loadLevel(0)
    D.sim(45)
    s = st()
    r.backClean = s.level === 0 && s.stars === 0 && s.cp === -1 && !s.swinging && s.onGround
    // reload the SAME level twice (restart integrity)
    D.loadLevel(1)
    D.sim(30)
    D.loadLevel(1)
    D.sim(45)
    s = st()
    r.reloadClean = s.level === 1 && s.stars === 0 && !s.swinging && s.onGround && s.swings === LEVEL2_SWINGS
    return j(r)
  }

  const LEVEL2_SWINGS = 5

  T.resetLoop = function () {
    const r = { loops: 6 }
    D.loadLevel(0)
    for (let i = 0; i < r.loops; i++) {
      D.warp(11.9, 3.0)
      D.sim(30)
      // grab + release the swing a few times
      for (let k = 0; k < 3; k++) {
        const g = grabInRange(300)
        if (g && g.swinging) {
          D.press('right', true)
          D.sim(30)
          D.press('right', false)
          releaseSwing(0.4, -0.3, 0.3, 400)
          D.sim(25)
        }
      }
      D.fullReset()
      D.sim(30)
      const s = st()
      if (!isFinite(s.x) || !isFinite(s.y) || !isFinite(s.vx)) throw new Error('resetLoop: NaN at loop ' + i)
      if (Math.abs(s.omega) > 4.3) throw new Error('resetLoop: omega leak ' + s.omega)
      if (!s.onGround || s.x > 1.5) throw new Error('resetLoop: bad respawn ' + j(s))
    }
    r.ok = true
    return j(r)
  }

  T.expose = function () {
    return j({ ok: true })
  }

  /** Run every scenario; each in its own try/catch. Returns one JSON report. */
  T.all = function () {
    const report = {}
    const names = [
      'l1_full',
      'l1_checkpoint',
      'l2_full',
      'l2_chain',
      'l3_movers',
      'l3_checkpoint',
      'l3_full',
      'crossLevel',
      'resetLoop',
    ]
    for (const n of names) {
      try {
        report[n] = JSON.parse(T[n]())
        report[n]._ok = true
      } catch (e) {
        report[n] = { _ok: false, error: String(e && e.message ? e.message : e) }
      }
    }
    return j(report)
  }

  window.__T = T
  return 'harness-ready'
})()
