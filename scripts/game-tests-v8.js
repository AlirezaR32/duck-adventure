/**
 * Project Duck V0.8 — L4 (Cloud Garden) test scenarios.
 *
 * INJECT game-tests-v6.js FIRST (it provides window.__T and the base
 * scenarios), then inject this file: it ADDS l4_* scenarios and extends
 * T.all() to run the full V0.8 regression suite.
 *
 * New scenarios:
 *   l4_part1     — teaching hop, S1 climb (CP1), long vine S2 → burr island
 *   l4_part2     — cross the thorn burr, ride the ferry, chain S3→S4 → P5
 *   l4_part3     — the double-vine finale (S5 → S6) → grand garden → flag
 *   l4_full      — part1 + part2 + part3 composed end-to-end
 *   l4_hazard    — the burr: safe standstill is untouched, walking into it
 *                  respawns at the last checkpoint
 *   l4_checkpoint— fall after CP3 → respawn there
 *   l4_shortcut  — expert line: early max-pump S5 release lands the high
 *                  shortcut isle (83.0–85.2)
 */
;(function () {
  const D = window.__duck
  const T = window.__T
  if (!D || !T) return 'NEED v6 HARNESS FIRST'

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

  // ============================ L4 — part 1 ============================

  T.l4_part1 = function () {
    const log = []
    D.loadLevel(3)
    D.sim(30)
    settleSwings('L4')
    // teaching hop
    D.press('right', true)
    simUntil((q) => q.x >= 6.4 && q.onGround, 600, 'L4: reach P0 edge')
    tapJump()
    const hop = simUntil((q) => q.onGround, 500, 'L4: land hop isle')
    if (!(hop.x >= 9.1 && hop.x <= 12.5)) throw new Error('L4: hop landed ' + hop.x.toFixed(2))
    log.push('hop@' + hop.x.toFixed(2))
    log.push('starsAfterHop=' + hop.stars)
    // S1: pedestal swing → high garden
    D.press('right', true)
    simUntil((q) => q.x >= 12.1 && q.onGround, 600, 'L4: reach P1 edge')
    tapJump()
    const g = grabInRange(300)
    if (!g || !g.swinging) throw new Error('L4: S1 grab missed ' + j(st()))
    simUntil((q) => Math.abs(q.omega) >= 3.0, 900, 'L4: pump S1')
    releaseSwing(3.0, 0.6, 1.0)
    const p2 = simUntil((q) => q.onGround, 700, 'L4: land P2')
    if (!(p2.x >= 17.9 && p2.x <= 26.9)) throw new Error('L4: S1 landed ' + p2.x.toFixed(2))
    log.push('S1→' + p2.x.toFixed(2))
    D.press('right', false)
    D.sim(20)
    if (p2.cp < 0) throw new Error('L4: CP1 not activated')
    // S2: long hanging vine → wide garden (burr island)
    D.press('right', true)
    simUntil((q) => q.x >= 26.3 && q.onGround, 600, 'L4: reach P2 edge')
    tapJump()
    const g2 = grabInRange(300)
    if (!g2 || !g2.swinging) throw new Error('L4: S2 grab missed ' + j(st()))
    simUntil((q) => Math.abs(q.omega) >= 1.9, 900, 'L4: pump S2')
    releaseSwing(1.4, 0.3, 0.6)
    const p3 = simUntil((q) => q.onGround, 700, 'L4: land P3')
    D.press('right', false)
    if (!(p3.x >= 33.0 && p3.x <= 37.7)) throw new Error('L4: S2 landed ' + p3.x.toFixed(2) + ' (burr zone starts 37.8)')
    log.push('S2→' + p3.x.toFixed(2))
    return j({ part: 1, log, x: p3.x, cp: p3.cp, stars: p3.stars, hazards: st().hazards })
  }

  // ============================ L4 — parts 2+3 (state machine) ============================

  /**
   * Burr crossing (hop) → walk-on lily ferry → S3/S4 chain → double-vine
   * finale → flag. Runs a bounded slice (~200 sim steps) per call so the
   * CLI can drive long waits without eval timeouts (same pattern as l3_drive).
   */
  const l4ph = { phase: 0, log: [], chained: false, chainedS6: false, jumped: false, padWait: false, boarding: false, decayed: false }
  T.l4_reset2 = function () {
    l4ph.phase = 0
    l4ph.log = []
    l4ph.chained = false
    l4ph.chainedS6 = false
    l4ph.jumped = false
    l4ph.padWait = false
    l4ph.boarding = false
    l4ph.decayed = false
    l4ph.armed = false
    l4ph.rel = null
    return 'reset'
  }
  T.l4_drive = function () {
    const MAX = 200
    let steps = 0
    let s = st()
    const advance = () => {
      l4ph.phase++
      l4ph.log.push('ph' + l4ph.phase)
    }
    const tryGrab = () => {
      D.press('interact', true)
      D.sim(1)
      D.press('interact', false)
      s = st()
      return s.swinging
    }
    while (steps < MAX) {
      s = st()
      const p = l4ph.phase
      if (p === 0) {
        // the S2 vine release lands with ~9.7 u/s of preserved momentum —
        // bleed it off first, otherwise the hop flight is unpredictable
        // (it can overshoot P3 into the ferry gap)
        if (!l4ph.decayed) {
          D.press('right', false)
          D.sim(1)
          steps++
          s = st()
          if (s.onGround && s.vx <= 4.3) l4ph.decayed = true
        } else {
          // sprint at the burr and HOP IT with a relative-distance trigger:
          // jump when the burr is ~1.65u ahead at full run — the arc clears
          // its 1.3u top with real margin on both ascent and descent
          if (s.x < 30 && l4ph.jumped) throw new Error('l4_drive: respawned mid-burr-crossing')
          D.press('right', true)
          D.sim(1)
          steps++
          s = st()
          if (!l4ph.jumped && s.onGround && s.vx >= 4.0 && s.hazardX - s.x >= 1.55 && s.hazardX - s.x <= 1.75) {
            D.press('jump', true)
            D.sim(1)
            D.press('jump', false)
            l4ph.jumped = true
            s = st()
          }
          if (l4ph.jumped && s.x >= 40.4 && s.onGround) {
            D.press('right', false)
            l4ph.log.push('burr hopped @' + s.x.toFixed(1))
            advance()
          }
        }
      } else if (p === 1) {
        // walk to the edge zone, WAIT for the pad to arrive near its left
        // extreme (nearly stationary), then walk on. The onPad check runs
        // in every sub-state: however the duck gets on the pad (walk-on,
        // a hop landing, being carried), the machine advances.
        const isOnPad = s.onGround && s.moverTop <= 0.3 && s.y > 0.5 && Math.abs(s.x - s.moverX) < 1.7
        if (isOnPad) {
          D.press('right', false)
          D.press('left', false)
          l4ph.padWait = false
          l4ph.boarding = false
          l4ph.log.push('onPad@' + s.x.toFixed(1))
          advance()
        } else if (!l4ph.padWait) {
          D.press('right', true)
          D.sim(1)
          steps++
          s = st()
          if (s.x >= 40.6 && s.onGround) {
            D.press('right', false)
            l4ph.padWait = true
          } else if (!s.onGround && s.y < -0.5) {
            throw new Error('l4_drive: fell before the edge wait ' + j(s))
          }
        } else {
          D.sim(1)
          steps++
          s = st()
          // wait for the pad to arrive near its LEFT extreme (slow, about
          // to reverse) so the walk-on can never outrun it
          if (s.moverX <= 42.15) {
            D.press('right', true)
            l4ph.padWait = false
            l4ph.boarding = true
          }
        }
        if (l4ph.boarding) {
          D.sim(1)
          steps++
          s = st()
          const onPad2 = s.onGround && s.moverTop <= 0.3 && s.y > 0.5 && Math.abs(s.x - s.moverX) < 1.7
          if (onPad2) {
            D.press('right', false)
            l4ph.boarding = false
            l4ph.log.push('onPad@' + s.x.toFixed(1))
            advance()
          } else if (!s.onGround && s.y < -0.5) {
            throw new Error('l4_drive: fell while boarding the pad x=' + s.x.toFixed(2) + ' mx=' + s.moverX)
          } else if (s.x < 30) {
            throw new Error('l4_drive: respawned during boarding (cannot recover without the vine) ' + j(s))
          }
        }
      } else if (p === 2) {
        // ride the pad to the right extreme (carried by the physics carrier)
        D.sim(1)
        steps++
        s = st()
        if (s.moverX >= 46.9) {
          if (!s.onGround) throw new Error('l4_drive: lost the pad mid-ride')
          advance()
        }
      } else if (p === 3) {
        // walk toward the pad's right edge and jump off to P4 — the jump
        // needs full run momentum, so require vx ≥ 4.0 at the trigger
        if (s.x < 40 && l4ph.jumped) throw new Error('l4_drive: respawned during the jump-off')
        D.press('right', true)
        D.sim(1)
        steps++
        s = st()
        if (s.onGround && s.x >= 47.9 && s.vx >= 4.0) {
          D.press('jump', true)
          D.sim(1)
          D.press('jump', false)
          advance()
        }
      } else if (p === 4) {
        if (s.x < 46 && s.onGround) throw new Error('l4_drive: respawned during the P4 landing')
        D.press('right', true)
        D.sim(1)
        steps++
        s = st()
        if (s.onGround && s.x >= 50.0) {
          D.press('right', false)
          if (!(s.x >= 50.6 && s.x <= 54.6)) throw new Error('l4_drive: P4 landing ' + s.x.toFixed(2))
          l4ph.log.push('P4@' + s.x.toFixed(1))
          advance()
        }
      } else if (p === 5) {
        // walk to the P4 edge and grab S3
        D.press('right', true)
        D.sim(1)
        steps++
        s = st()
        if (s.onGround && s.x >= 54.2) {
          D.press('jump', true)
          D.sim(1)
          D.press('jump', false)
          advance()
        }
      } else if (p === 6) {
        D.sim(1)
        steps++
        s = st()
        if (s.inRange && !s.swinging) {
          if (!tryGrab()) throw new Error('l4_drive: S3 grab failed ' + j(s))
          l4ph.log.push('S3 grabbed')
          advance()
        } else if (!s.swinging && !s.onGround && s.y < -1) {
          throw new Error('l4_drive: fell before S3 grab ' + j(s))
        }
      } else if (p === 7) {
        // pump S3 hard, then release into the chain window
        D.press('right', true)
        D.sim(1)
        steps++
        s = st()
        if (s.omega >= 3.2) {
          D.releaseWhen(2.6, 0.55, 1.1)
          advance()
        }
      } else if (p === 8) {
        // flying: try the mid-air chain onto S4; if we land instead, the
        // safe route continues from the catch isle
        D.sim(1)
        steps++
        s = st()
        if (s.inRange && !s.swinging) {
          if (tryGrab() && Math.abs(s.swingX - 65.4) < 0.01) {
            l4ph.chained = true
            l4ph.log.push('MID-AIR CHAIN onto S4 @' + s.x.toFixed(1))
            advance() // → 9 pump S4
          } else {
            // grabbed the old swing again — let go immediately
            D.press('interact', true)
            D.sim(1)
            D.press('interact', false)
          }
        } else if (s.onGround) {
          l4ph.log.push('safe route: landed ' + s.x.toFixed(1))
          l4ph.phase = 11 // walk to the catch isle edge
          l4ph.log.push('ph11')
        } else if (s.y < -2) {
          throw new Error('l4_drive: chain flight fell into the void ' + j(s))
        }
      } else if (p === 9) {
        // pump S4 (after a mid-air chain or a safe-route grab)
        D.press('right', true)
        D.sim(1)
        steps++
        s = st()
        if (Math.abs(s.omega) >= 1.9) {
          D.releaseWhen(1.4, 0.4, 0.7)
          l4ph.armed = true
          advance()
        }
      } else if (p === 10) {
        // land P5 after S4
        D.sim(1)
        steps++
        s = st()
        if (!l4ph.trace10) l4ph.trace10 = []
        if (l4ph.trace10.length < 200) {
          l4ph.trace10.push([s.x.toFixed(1), s.y.toFixed(2), s.vx.toFixed(1), s.vy.toFixed(1), s.swinging ? 1 : 0, s.onGround ? 1 : 0])
        }
        if (!s.swinging && !l4ph.rel) l4ph.rel = { theta: s.theta, omega: s.omega, vx: s.vx, vy: s.vy, x: s.x, y: s.y }
        if (s.onGround) {
          D.press('right', false)
          if (!(s.x >= 69.4 && s.x <= 77.7)) {
            l4ph.badLand = { x: s.x, y: s.y, vx: s.vx, vy: s.vy, cp: s.cp, rel: l4ph.rel }
            l4ph.phase = 99 // halt without throwing; l4ph.badLand holds the evidence
            l4ph.log.push('ph99')
            return j({ done: false, phase: 99, steps, log: l4ph.log, chained: l4ph.chained, chainedS6: l4ph.chainedS6, ...s })
          }
          if (s.cp < 2) throw new Error('l4_drive: CP3 missing after S4 ' + j(s))
          l4ph.log.push('P5@' + s.x.toFixed(1))
          l4ph.phase = 13 // walk to the P5 edge for the finale (NOT the safe-route phases)
          l4ph.log.push('ph13')
        }
      } else if (p === 11) {
        // safe route: run to the catch isle edge, jump, grab S4
        D.press('right', true)
        D.sim(1)
        steps++
        s = st()
        if (s.onGround && s.x >= 63.8) {
          D.press('jump', true)
          D.sim(1)
          D.press('jump', false)
          advance()
        }
      } else if (p === 12) {
        D.sim(1)
        steps++
        s = st()
        if (s.inRange && !s.swinging) {
          if (!tryGrab()) throw new Error('l4_drive: S4 grab failed (safe) ' + j(s))
          l4ph.log.push('S4 grabbed (safe)')
          l4ph.phase = 9
          l4ph.log.push('ph9')
        } else if (!s.swinging && !s.onGround && s.y < -1) {
          throw new Error('l4_drive: fell before S4 grab ' + j(s))
        }
      } else if (p === 13) {
        // walk to the P5 edge and grab S5 (finale vine 1)
        D.press('right', true)
        D.sim(1)
        steps++
        s = st()
        if (s.onGround && s.x >= 77.2) {
          D.press('jump', true)
          D.sim(1)
          D.press('jump', false)
          advance()
        }
      } else if (p === 14) {
        D.sim(1)
        steps++
        s = st()
        if (s.inRange && !s.swinging) {
          if (!tryGrab()) throw new Error('l4_drive: S5 grab failed ' + j(s))
          l4ph.log.push('S5 grabbed')
          advance()
        } else if (!s.swinging && !s.onGround && s.y < -1) {
          throw new Error('l4_drive: fell before S5 grab ' + j(s))
        }
      } else if (p === 15) {
        // pump S5 to near the cap, release mid-window for the chain line
        D.press('right', true)
        D.sim(1)
        steps++
        s = st()
        if (s.omega >= 2.25) {
          // high release: the flight arcs well over the shortcut isle and
          // dips into S6's grab zone at x≈86 (a lower release clips the
          // isle wall — that low line is the expert shortcut instead)
          D.releaseWhen(1.8, 0.75, 1.1)
          advance()
        }
      } else if (p === 16) {
        // finale flight: chain onto S6 mid-air, or fall back to the catch
        D.sim(1)
        steps++
        s = st()
        if (!l4ph.trace16) l4ph.trace16 = []
        if (l4ph.trace16.length < 160) {
          l4ph.trace16.push([s.x.toFixed(1), s.y.toFixed(2), s.vx.toFixed(1), s.vy.toFixed(1), s.swinging ? 1 : 0, s.nearD])
        }
        if (s.inRange && !s.swinging) {
          if (tryGrab() && Math.abs(s.swingX - 86.0) < 0.01) {
            l4ph.chainedS6 = true
            l4ph.log.push('FINALE CHAIN onto S6 @' + s.x.toFixed(1))
            advance() // → 17
          } else {
            D.press('interact', true)
            D.sim(1)
            D.press('interact', false)
          }
        } else if (s.onGround) {
          if (!(s.x >= 82.4 && s.x <= 85.4)) {
            throw new Error('l4_drive: S5 fallback landing ' + s.x.toFixed(2))
          }
          l4ph.log.push('S5→catch@' + s.x.toFixed(1))
          l4ph.phase = 19 // run to the catch edge and jump-grab S6
          l4ph.log.push('ph19')
        } else if (s.y < -2) {
          throw new Error('l4_drive: finale flight fell ' + j(s))
        }
      } else if (p === 17) {
        // pump S6 and send it home
        D.press('right', true)
        D.sim(1)
        steps++
        s = st()
        if (s.omega >= 3.0) {
          D.releaseWhen(2.6, 0.5, 0.95)
          advance()
        }
      } else if (p === 18) {
        // grand garden landing
        D.sim(1)
        steps++
        s = st()
        if (s.onGround) {
          D.press('right', false)
          if (!(s.x >= 88.2 && s.x <= 98.6)) throw new Error('l4_drive: finale landing ' + s.x.toFixed(2))
          l4ph.log.push('S6→' + s.x.toFixed(1))
          l4ph.phase = 21 // run to the flag (19/20 are the safe-route path only)
          l4ph.log.push('ph21')
        }
      } else if (p === 19) {
        // shortcut descent: run to the isle's right edge and leap for the
        // grand garden — the shortcut SKIPS S6 entirely (faster route)
        if (s.x < 84.8 && s.onGround) {
          D.press('right', true)
          D.sim(1)
          steps++
          s = st()
          if (s.x >= 84.8 && s.onGround) {
            D.press('jump', true)
            D.sim(1)
            D.press('jump', false)
            advance()
          }
        } else {
          D.press('jump', true)
          D.sim(1)
          D.press('jump', false)
          advance()
        }
      } else if (p === 20) {
        D.sim(1)
        steps++
        s = st()
        if (s.onGround) {
          D.press('right', false)
          if (s.x >= 88.2) {
            l4ph.log.push('shortcut→P6 @' + s.x.toFixed(1))
            l4ph.phase = 21
            l4ph.log.push('ph21')
          } else {
            throw new Error('l4_drive: shortcut leap landed ' + s.x.toFixed(2))
          }
        } else if (s.y < -2) {
          throw new Error('l4_drive: shortcut leap fell ' + j(s))
        }
      } else if (p === 21) {
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
        return j({ done: true, phase: l4ph.phase, log: l4ph.log, chained: l4ph.chained, chainedS6: l4ph.chainedS6, ...s })
      }
    }
    return j({ done: false, phase: l4ph.phase, steps, log: l4ph.log, chained: l4ph.chained, chainedS6: l4ph.chainedS6, ...s })
  }

  /** Debug access to the machine's internal state (traces, evidence). */
  T.l4_dbg = function () {
    return j(l4ph)
  }

  /** In-page wrapper: part1 then the full state machine. */
  T.l4_full = function () {
    const a = JSON.parse(T.l4_part1())
    T.l4_reset2()
    let r = JSON.parse(T.l4_drive())
    let guard = 0
    while (!r.done && guard++ < 200) r = JSON.parse(T.l4_drive())
    if (!r.done) throw new Error('l4_full: drive stalled at phase ' + r.phase + ' ' + j(r))
    return j({
      log: [...a.log, ...r.log],
      won: r.won,
      stars: r.stars,
      x: r.x,
      cp: r.cp,
      level: r.level,
      chained: r.chained,
      chainedS6: r.chainedS6,
    })
  }

  // ============================ hazard behaviour ============================

  T.l4_hazard = function () {
    const r = {}
    D.loadLevel(3)
    D.sim(30)
    // activate CP1 first (walk onto the high garden post)
    D.warp(21.8, 3.0)
    D.sim(40)
    if (st().cp < 0) {
      D.press('right', true)
      simUntil((q) => q.x >= 21.8 && q.onGround, 400, 'hazard: reach CP1')
      D.press('right', false)
      D.sim(10)
    }
    if (st().cp < 0) throw new Error('hazard: CP1 not active')
    r.cpBefore = st().cp
    // teleport next to the burr island — standing OUTSIDE the patrol zone
    // must be safe for a full patrol period
    D.warp(34.6, 3.0)
    D.sim(60)
    const period = Math.round((2 * Math.PI) / 0.6 * 60) + 30
    let touched = false
    for (let i = 0; i < period; i++) {
      D.sim(1)
      const s = st()
      if (s.hazardD < 0.62) {
        touched = true
        break
      }
    }
    r.safeStand = !touched && st().cp >= 0 && !st().won
    if (touched) throw new Error('hazard: touched while standing at 34.6 (hazardD ' + st().hazardD + ')')
    // now walk into the patrol zone → expect a prick + respawn at CP1.
    // The prick itself is invisible to the poll (the game respawns within
    // the same sim step), so detect the RESPAWN: the duck's x drops back
    // below 30 mid-walk. If it slips past the burr, walk back and retry.
    let pricked = false
    for (let attempt = 0; attempt < 4 && !pricked; attempt++) {
      // return to the approach point if a previous attempt overshot
      if (st().x > 35 || st().x < 30) {
        D.warp(34.6, 3.0)
        D.sim(40)
      }
      D.press('right', true)
      for (let i = 0; i < 700; i++) {
        D.sim(1)
        const s = st()
        if (s.x < 30 && !s.onGround) {
          // respawned mid-walk → the burr got us
          pricked = true
          break
        }
        if (s.onGround && s.x > 41.5) break // slipped past — retry
      }
      D.press('right', false)
    }
    if (!pricked) throw new Error('hazard: walked the patrol zone 4x without a prick (or never respawned)')
    simUntil((q) => q.onGround, 600, 'hazard: respawn+settle')
    const s = st()
    r.pricked = true
    r.respawnedAtCP = s.cp === r.cpBefore && Math.abs(s.x - 21.8) < 0.7 && s.onGround
    if (!r.respawnedAtCP) throw new Error('hazard: respawn wrong cp=' + s.cp + ' x=' + s.x.toFixed(2))
    return j(r)
  }

  // ============================ checkpoint (post-CP3) ============================

  T.l4_checkpoint = function () {
    D.loadLevel(3)
    D.sim(30)
    D.warp(72.5, 3.0)
    D.sim(40)
    let s = st()
    if (s.cp < 2) {
      D.press('right', true)
      simUntil((q) => q.x >= 72.5 && q.onGround, 400, 'L4cp: reach post')
      D.press('right', false)
      D.sim(10)
      s = st()
    }
    const cpBefore = s.cp
    if (cpBefore < 2) throw new Error('L4cp: CP3 not active')
    // run off the LEFT edge of P5 into the chain gap → kill plane
    D.press('left', true)
    simUntil((q) => !q.onGround, 400, 'L4cp: run off edge')
    D.press('left', false)
    simUntil((q) => q.onGround, 600, 'L4cp: respawn+settle')
    s = st()
    return j({
      cpBefore,
      cpAfter: s.cp,
      x: s.x,
      atCheckpoint: s.cp === cpBefore && Math.abs(s.x - 72.5) < 0.7 && s.onGround,
    })
  }

  // ============================ expert shortcut ============================

  T.l4_shortcut = function () {
    const r = { events: [], attempts: [] }
    // The shortcut isle (83.0–85.2, top 4.5) is reachable from S5 with a
    // high-theta release near the pump cap. Player timing varies, so try a
    // couple of honest release windows and report which one connects.
    const windows = [
      [2.0, 0.5, 0.62],
      [2.25, 0.6, 0.66],
      [2.3, 0.63, 0.72],
    ]
    for (const [minO, lo, hi] of windows) {
      D.loadLevel(3)
      D.sim(30)
      settleSwings('L4s')
      D.warp(75.0, 3.0)
      D.sim(40)
      D.press('right', true)
      simUntil((q) => q.x >= 77.2 && q.onGround, 600, 'shortcut: reach P5 edge')
      tapJump()
      const g = grabInRange(300)
      if (!g || !g.swinging) throw new Error('shortcut: S5 grab missed ' + j(st()))
      simUntil((q) => q.omega >= 2.3, 900, 'shortcut: pump S5 to cap')
      releaseSwing(minO, lo, hi)
      const landed = simUntil((q) => q.onGround, 700, 'shortcut: land')
      D.press('right', false)
      const attempt = {
        window: [minO, lo, hi],
        landedX: Math.round(landed.x * 100) / 100,
        landedY: Math.round(landed.y * 100) / 100,
      }
      r.attempts.push(attempt)
      if (landed.x >= 82.5 && landed.x <= 85.5 && landed.y > 4.0) {
        r.ok = true
        r.events.push('isle reached with window ' + j([minO, lo, hi]))
        break
      }
      r.events.push('window ' + j([minO, lo, hi]) + ' missed → ' + landed.x.toFixed(1))
    }
    if (!r.ok) throw new Error('shortcut: no window landed the isle ' + j(r.attempts))
    return j(r)
  }

  // ============================ extended suite runner ============================

  const BASE_NAMES = [
    'l1_full',
    'l1_checkpoint',
    'l2_full',
    'l2_chain',
    'l3_movers',
    'l3_checkpoint',
    'l3_full',
    'crossLevel4',
    'resetLoop',
  ]
  const L4_NAMES = [
    'l4_part1',
    'l4_full',
    'l4_hazard',
    'l4_checkpoint',
    'l4_shortcut',
  ]

  /** crossLevel extended to 4 levels (state must stay pristine in both directions). */
  T.crossLevel4 = function () {
    const r = {}
    D.loadLevel(0)
    D.sim(30)
    D.warp(34.0, 3.0)
    D.sim(40)
    D.press('right', true)
    simUntil((q) => q.won, 600, 'cross4: win L1')
    D.press('right', false)
    r.l1won = st().won
    D.loadLevel(3)
    D.sim(45)
    let s = st()
    r.l4clean = s.level === 3 && s.stars === 0 && s.cp === -1 && !s.swinging && !s.won && s.onGround && s.hazards === 1
    D.loadLevel(0)
    D.sim(45)
    s = st()
    r.backClean = s.level === 0 && s.stars === 0 && s.cp === -1 && !s.swinging && s.onGround
    D.loadLevel(3)
    D.sim(30)
    D.loadLevel(3)
    D.sim(45)
    s = st()
    r.reloadClean = s.level === 3 && s.stars === 0 && !s.swinging && s.onGround && s.swings === 6
    return j(r)
  }

  T.all = function () {
    const report = {}
    for (const n of [...BASE_NAMES, ...L4_NAMES]) {
      try {
        report[n] = JSON.parse(T[n]())
        report[n]._ok = true
      } catch (e) {
        report[n] = { _ok: false, error: String(e && e.message ? e.message : e) }
      }
    }
    return j(report)
  }

  T.allV8 = T.all
  window.__T = T
  return 'v8-harness-ready'
})()
