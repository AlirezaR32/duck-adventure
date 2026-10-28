/**
 * Project Duck V0.6/V0.8 — level definitions (pure data + decor placement).
 *
 * V0.8 — four connected fantasy regions on one difficulty curve:
 *   A  Enchanted Meadow  — teach run / jump / grab / pump / release
 *   B  Floating Islands  — reward momentum, mid-air chain pair, brave line
 *   C  Crystal Canyon    — demanding: stone slabs, narrow fair landings,
 *                          the first thorn burr, checkpoint before the climb
 *   D  Cloud Garden      — the sky finale: ferry ride, chain zone, the
 *                          double-vine grand finale + an optional high
 *                          shortcut isle for skilled players
 *
 * Reachability rules used while placing geometry (measured, not guessed):
 *   run-jump range  ≈ 3.1u flat, rise ≈ 2.0u
 *   swing release   crosses 4–8u gaps at omega 2.6–3.4 (window theta 0.55–1.1)
 *   platforms that host a grab must END within ~0.5u of the swing x
 */

import type { MotionDef } from './Physics'
import type { SwingCfg } from './Swing'
import {
  bigFlower,
  bush,
  crystal,
  floatingRock,
  flower,
  Kit,
  lantern,
  mushroom,
  puffPlant,
  ringGate,
  rock,
  ropeBridge,
  startSign,
  tree,
  waterfall,
} from './LevelKit'

import type { HazardDef, OrbitHazardDef } from './LevelKit'

export interface PlatDef {
  x1: number
  x2: number
  top: number
}

export interface MoverDef {
  cx: number
  top: number
  w: number
  motion: MotionDef
}

export interface CheckpointDef {
  x: number
  y: number
  plat: number
}

export interface LevelDef {
  id: string
  name: string
  subtitle: string
  /** One-line hint shown on the level intro card (teach by design, not walls of text). */
  hint: string
  /** Fantasy region identity (intro card + level picker). */
  region: string
  theme: 'meadow' | 'isles' | 'canyon' | 'garden' | 'hollow'
  spawnX: number
  flagX: number
  killY: number
  platforms: PlatDef[]
  movers: MoverDef[]
  pedestals: { x: number; top: number }[]
  swings: SwingCfg[]
  checkpoints: CheckpointDef[]
  stars: { x: number; y: number }[]
  hazards?: HazardDef[]
  /** Airborne orbiting hazards (Region E's wisp swarm) — see LevelKit.wispSwarm. */
  wisps?: OrbitHazardDef[]
  buildDecor: (kit: Kit) => void
}

// ============================ Level 1 — Meadow Swing ============================

const L1: LevelDef = {
  id: 'meadow',
  name: 'Meadow Swing',
  subtitle: 'Learn the ropes',
  hint: 'Run with the arrows, JUMP the gap, then GRAB the swing!',
  region: 'Region A — Enchanted Meadow',
  theme: 'meadow',
  spawnX: 0.4,
  flagX: 34.6,
  killY: -8,
  platforms: [
    { x1: -3.4, x2: 7.8, top: 0 }, // start meadow
    { x1: 9.9, x2: 13.1, top: 0.35 }, // hop island (teaches the jump)
    { x1: 17.8, x2: 25.8, top: 0.2 }, // wide landing after swing 1
    { x1: 29.8, x2: 37.4, top: 0.5 }, // finish island
  ],
  movers: [],
  pedestals: [],
  swings: [
    { x: 11.7, type: 'frame', baseY: 0.35, L: 3.1, pivotH: 3.9, range: 2.3 },
    { x: 24.2, type: 'frame', baseY: 0.2, L: 3.2, pivotH: 4.0, range: 2.3 },
  ],
  checkpoints: [{ x: 21.5, y: 0.2, plat: 2 }],
  stars: [
    { x: 8.8, y: 2.2 }, // above the teaching jump
    { x: 14.9, y: 2.8 }, // S1 arc
    { x: 16.1, y: 3.3 },
    { x: 27.4, y: 3.0 }, // S2 arc
    { x: 28.5, y: 3.4 },
  ],
  buildDecor(kit) {
    startSign(kit, 1.7, 0)
    tree(kit, 3.2, -5.0, 1.05)
    tree(kit, 6.4, -4.6, 0.9)
    bush(kit, 5.6, 0, -1.1, 0.95)
    rock(kit, 6.6, 0.05, -1.25, 0.8, kit.theme.rockB)
    bush(kit, 12.4, 0.35, -1.0, 0.8)
    // little welcome garden on the wide landing
    bigFlower(kit, 19.2, 0.2, -1.15, 1.1, kit.theme.leafPink)
    bigFlower(kit, 22.1, 0.2, -1.3, 0.9, kit.theme.flowerC)
    mushroom(kit, 20.1, 0.2, -0.9, 0.95)
    tree(kit, 24.9, -5.2, 1.0, true)
    waterfall(kit, 18.35, 0.2)
    // finish island celebration
    tree(kit, 31.2, -5.4, 1.05)
    bush(kit, 32.6, 0.5, -1.05, 1.0)
    flower(kit, 33.4, 0.5, 0.75, kit.theme.flowerB)
    flower(kit, 36.1, 0.5, -0.7, kit.theme.flowerA)
  },
}

// ============================ Level 2 — Floating Isles ============================

const L2: LevelDef = {
  id: 'isles',
  name: 'Floating Isles',
  subtitle: 'Keep your speed',
  hint: 'Release at the top of the arc — momentum carries you across.',
  region: 'Region B — Floating Islands',
  theme: 'isles',
  spawnX: 0.4,
  flagX: 64.6,
  killY: -8,
  platforms: [
    { x1: -3.4, x2: 6.6, top: 0 }, // start
    { x1: 13.0, x2: 22.2, top: 1.2 }, // high isle (climb reward)
    { x1: 27.4, x2: 35.2, top: -0.2 }, // low isle
    { x1: 41.0, x2: 46.2, top: -0.4 }, // catch isle for S3 sends
    { x1: 51.2, x2: 58.0, top: 0.7 }, // wide isle (any S4 release lands)
    { x1: 61.4, x2: 67.0, top: 2.0 }, // high finish
  ],
  movers: [],
  pedestals: [
    { x: 9.4, top: -0.4 },
    { x: 38.0, top: -0.5 },
  ],
  swings: [
    // S1 pedestal swing: climb to the high isle
    { x: 9.4, type: 'frame', baseY: -0.4, L: 3.2, pivotH: 4.0, range: 2.3 },
    // S2 long hanging vine over the wide gap
    { x: 22.6, type: 'hanging', pivotY: 7.0, L: 4.7, range: 2.4 },
    // S3 pedestal swing — release hard and CHAIN mid-air onto S4…
    { x: 38.0, type: 'frame', baseY: -0.5, L: 3.3, pivotH: 4.2, range: 2.3 },
    // …or land on the catch isle and grab S4 from its edge (safe route)
    { x: 46.6, type: 'hanging', pivotY: 6.2, L: 4.7, range: 2.4 },
    // S5 climb to the high finish
    { x: 56.4, type: 'frame', baseY: 0.7, L: 3.0, pivotH: 3.5, range: 2.2 },
  ],
  checkpoints: [
    { x: 30.0, y: -0.2, plat: 2 },
    { x: 54.5, y: 0.7, plat: 4 },
  ],
  stars: [
    { x: 10.9, y: 3.4 }, // S1 climb arc
    { x: 20.6, y: 4.6 }, // brave line: strong S2 release
    { x: 24.6, y: 3.0 }, // S2 arc
    { x: 43.2, y: 2.6 }, // S3 arc
    { x: 48.6, y: 3.2 }, // mid-air chain zone
    { x: 59.6, y: 3.6 }, // S5 arc
    { x: 63.0, y: 4.2 }, // above the finish climb
  ],
  buildDecor(kit) {
    startSign(kit, 1.7, 0)
    tree(kit, 3.0, -5.2, 1.0)
    bush(kit, 4.9, 0, -1.1, 0.9)
    // high isle
    tree(kit, 15.0, -5.0, 1.05, true)
    crystal(kit, 19.8, 1.2, -1.05, 0.9)
    lantern(kit, 20.6, 1.2, -0.75, 1.0)
    rock(kit, 14.4, 1.2, -1.2, 0.7, kit.theme.rockA)
    // low isle
    mushroom(kit, 28.6, -0.2, -0.9, 0.85)
    bush(kit, 33.0, -0.2, -1.05, 0.95)
    crystal(kit, 34.2, -0.2, -1.2, 1.0)
    // catch isle + chain zone
    crystal(kit, 42.4, -0.4, -1.1, 1.1, kit.theme.crystalGold)
    floatingRock(kit, 44.4, 3.4, -7.5, 0.9)
    floatingRock(kit, 48.6, 5.2, -9.5, 1.15)
    // wide isle garden
    bigFlower(kit, 52.6, 0.7, -1.15, 1.05, kit.theme.leafPinkLight)
    mushroom(kit, 55.2, 0.7, -0.95, 0.8)
    tree(kit, 56.8, -5.6, 1.1)
    // finish spire
    crystal(kit, 63.4, 2.0, -1.05, 1.2)
    crystal(kit, 65.6, 2.0, -1.3, 0.85, kit.theme.crystalGold)
    floatingRock(kit, 60.4, 5.6, -10.5, 0.8)
    floatingRock(kit, 65.4, 6.4, -12, 1.3)
  },
}

// ============================ Level 3 — Crystal Canyon ============================

const L3: LevelDef = {
  id: 'canyon',
  name: 'Crystal Canyon',
  subtitle: 'The final traversal',
  hint: 'Ride the stone slabs — the checkpoint waits before the big climb.',
  region: 'Region C — Crystal Canyon',
  theme: 'canyon',
  spawnX: 0.4,
  flagX: 71.0,
  killY: -8,
  platforms: [
    { x1: -3.2, x2: 6.6, top: 0 }, // start ledge
    { x1: 12.8, x2: 17.2, top: 1.0 }, // narrow but fair
    { x1: 24.2, x2: 31.4, top: 0.5 }, // slab-side isle (burr patrols the middle)
    { x1: 36.6, x2: 40.2, top: -0.8 }, // deep canyon ledge
    { x1: 46.4, x2: 51.8, top: 1.6 }, // checkpoint isle (hardest section starts after)
    { x1: 57.6, x2: 61.6, top: 3.0 }, // crystal spire
    { x1: 66.4, x2: 73.8, top: 0.3 }, // grand landing + flag
  ],
  movers: [
    // M1: ferry slab across the first wide gap (P2 → P3)
    { cx: 20.7, top: 0.7, w: 2.6, motion: { axis: 'x', amp: 1.25, speed: 1.05, phase: 0 } },
    // M2: elevator slab up to the spire (top oscillates 1.3 ↔ 2.7)
    { cx: 54.6, top: 2.0, w: 2.8, motion: { axis: 'y', amp: 0.7, speed: 0.85, phase: 0 } },
  ],
  pedestals: [
    { x: 9.2, top: -0.4 },
    { x: 42.6, top: -0.5 },
  ],
  swings: [
    // S1 elevated pedestal swing up to the narrow ledge
    { x: 9.2, type: 'frame', baseY: -0.4, L: 3.3, pivotH: 4.4, range: 2.3 },
    // S2 long vine over the deep gap
    { x: 31.8, type: 'hanging', pivotY: 7.0, L: 4.7, range: 2.4 },
    // S3 low quick swing, climbs to the checkpoint isle
    { x: 42.6, type: 'frame', baseY: -0.5, L: 3.0, pivotH: 4.2, range: 2.2 },
    // S4 grand finale from the spire
    { x: 60.2, type: 'frame', baseY: 3.0, L: 3.4, pivotH: 5.0, range: 2.2 },
  ],
  checkpoints: [
    { x: 15.0, y: 1.0, plat: 1 },
    { x: 49.2, y: 1.6, plat: 4 },
  ],
  stars: [
    { x: 20.7, y: 2.8 }, // above the slab ferry line
    { x: 33.8, y: 4.2 }, // S2 arc
    { x: 38.4, y: 1.4 }, // above the deep ledge
    { x: 49.9, y: 3.4 }, // checkpoint isle
    { x: 56.4, y: 4.6 }, // top of the elevator ride
    { x: 63.4, y: 6.4 }, // finale arc
  ],
  // first real hazard: a slow thorn burr resting on the slab-side isle.
  // The ferry lands around x≈27, the burr sweeps 28.2–29.6 — hop it (the
  // run-up jump clears its 1.34u top comfortably) or walk past while it
  // drifts left. A prick sends you to the checkpoint on the narrow ledge,
  // one ferry ride back.
  hazards: [{ x: 28.9, y: 0.72, travel: 0.7, speed: 0.55, phase: 0.5, ringY: 0.52 }],
  buildDecor(kit) {
    startSign(kit, 1.6, 0)
    tree(kit, 2.8, -5.2, 0.95)
    rock(kit, 4.8, 0, -1.2, 0.9, kit.theme.rockB)
    bush(kit, 5.8, 0, -1.05, 0.85)
    // canyon walls: big crystal formations + mesas far behind play
    crystal(kit, 6.4, -0.6, -9.0, 3.2)
    crystal(kit, 14.9, 1.0, -1.15, 1.1)
    crystal(kit, 16.3, 1.0, -1.35, 0.8, kit.theme.crystalGold)
    lantern(kit, 15.6, 1.0, -0.8, 0.9)
    floatingRock(kit, 20.8, 3.2, -8.0, 1.0)
    crystal(kit, 26.4, 0.5, -1.1, 1.15)
    crystal(kit, 29.9, 0.5, -1.3, 0.9, kit.theme.crystalGold)
    mushroom(kit, 27.5, 0.5, -0.9, 0.8)
    crystal(kit, 25.2, -1.2, -9.5, 2.6)
    // deep ledge
    crystal(kit, 37.6, -0.8, -1.05, 0.85, kit.theme.crystal)
    lantern(kit, 39.2, -0.8, -0.75, 0.85)
    crystal(kit, 45.0, -1.4, -9.0, 2.2, kit.theme.crystalGold)
    // checkpoint isle
    bush(kit, 50.8, 1.6, -1.05, 0.9)
    crystal(kit, 48.1, 1.6, -1.2, 0.95)
    floatingRock(kit, 54.7, 5.4, -9.0, 1.2)
    crystal(kit, 53.0, 0.4, -11, 3.0)
    // spire
    crystal(kit, 59.0, 3.0, -1.05, 1.2)
    crystal(kit, 61.0, 3.0, -1.3, 0.9, kit.theme.crystalGold)
    lantern(kit, 60.6, 3.0, -0.8, 1.0)
    crystal(kit, 60.4, 1.2, -12, 4.0)
    crystal(kit, 67.6, -0.4, -10, 3.4, kit.theme.crystalGold)
    // background suspension bridge — the canyon's old crossing, still intact
    ropeBridge(kit, 25.4, 1.9, 33.0, 1.5)
    // grand landing garden
    tree(kit, 68.6, -5.4, 1.0)
    bush(kit, 70.0, 0.3, -1.05, 0.95)
    flower(kit, 69.4, 0.3, 0.75, kit.theme.flowerB)
    flower(kit, 72.4, 0.3, -0.7, kit.theme.flowerA)
  },
}

// ============================ Level 4 — Cloud Garden (Region D) ============================

const L4: LevelDef = {
  id: 'garden',
  name: 'Cloud Garden',
  subtitle: 'The sky finale',
  hint: 'Chain the hanging vines — the garden floats past the rings.',
  region: 'Region D — Cloud Garden',
  theme: 'garden',
  spawnX: 0.4,
  flagX: 97.4,
  killY: -8,
  platforms: [
    { x1: -3.4, x2: 6.8, top: 0 }, // cloud garden start
    { x1: 9.2, x2: 12.4, top: 0.5 }, // teaching hop
    { x1: 17.9, x2: 26.9, top: 1.0 }, // high garden (S1 climb reward, CP1)
    { x1: 33.0, x2: 41.6, top: 0.1 }, // wide garden (burr patrols the right half)
    { x1: 50.6, x2: 54.6, top: 0.9 }, // ferry landing (CP2)
    { x1: 60.4, x2: 64.4, top: -0.3 }, // safe catch isle under the chain zone
    { x1: 69.4, x2: 77.7, top: 1.3 }, // wide garden (CP3, S5 launch edge)
    { x1: 83.0, x2: 85.2, top: 4.5 }, // OPTIONAL shortcut isle (early max-pump S5 release, skips S6)
    { x1: 88.2, x2: 98.6, top: 0.6 }, // grand garden + flag
  ],
  movers: [
    // M1: lily-pad ferry across the cloud gap (P3 → P4). Its top sits
    // 0.02 above P3 so the duck WALKS straight on when the pad overlaps
    // the platform edge at its left extreme — no jump-timing needed —
    // and rides it right through the ring gate. Falling is a soft
    // recovery back to CP1.
    { cx: 45.0, top: 0.12, w: 3.0, motion: { axis: 'x', amp: 3.0, speed: 0.8, phase: 0 } },
  ],
  pedestals: [{ x: 15.4, top: -0.3 }],
  swings: [
    // S1 pedestal swing up to the high garden
    { x: 15.4, type: 'frame', baseY: -0.3, L: 3.2, pivotH: 4.1, range: 2.3 },
    // S2 long hanging vine over the cloud gap
    { x: 27.4, type: 'hanging', pivotY: 7.4, L: 4.8, range: 2.4 },
    // S3 pedestal swing — release hard and CHAIN mid-air onto S4…
    { x: 57.4, type: 'frame', baseY: -0.4, L: 3.3, pivotH: 4.2, range: 2.3 },
    // …or land on the catch isle and grab S4 from its edge (safe route)
    { x: 65.4, type: 'hanging', pivotY: 7.0, L: 4.6, range: 2.4 },
    // S5 finale vine 1 — pump hard…
    { x: 78.2, type: 'hanging', pivotY: 7.8, L: 4.9, range: 2.4 },
    // S6 finale gate swing — short ropes put its seat right on the S5
    // flight line: release S5 at mid-arc and CHAIN mid-air onto S6, then
    // send it through the ring gate to the grand garden
    { x: 86.0, type: 'hanging', pivotY: 7.5, L: 3.2, range: 2.4 },
  ],
  checkpoints: [
    { x: 21.8, y: 1.0, plat: 2 },
    { x: 52.6, y: 0.9, plat: 4 },
    { x: 72.5, y: 1.3, plat: 6 },
  ],
  stars: [
    { x: 8.4, y: 2.5 }, // apex of the teaching hop
    { x: 19.9, y: 3.3 }, // S1 climb arc
    { x: 21.5, y: 3.2 }, // S1 arc, second gate
    { x: 30.2, y: 3.6 }, // S2 arc
    { x: 44.4, y: 2.2 }, // inside the ferry ring — hop during the ride!
    { x: 62.4, y: 2.8 }, // mid-air chain zone
    { x: 67.4, y: 3.4 }, // S4 arc
    { x: 83.8, y: 5.3 }, // shortcut isle (expert only)
    { x: 84.7, y: 5.3 }, // shortcut isle (expert only)
    { x: 90.0, y: 4.4 }, // grand finale arc
  ],
  hazards: [
    // second burr, on the wide garden after the long vine. The vine drops
    // you around x 34–37; the burr sweeps 37.8–39.4 — hop it or walk past
    // while it drifts left, then board the ferry at the right edge.
    { x: 38.6, y: 0.68, travel: 0.6, speed: 0.6, phase: 0 },
  ],
  buildDecor(kit) {
    startSign(kit, 1.7, 0)
    tree(kit, 3.2, -5.2, 1.0)
    puffPlant(kit, 4.9, 0, -1.1, 1.0)
    bush(kit, 5.8, 0, -1.05, 0.9)
    mushroom(kit, 2.3, 0, -0.95, 0.85)
    // teaching hop
    puffPlant(kit, 10.6, 0.5, -1.0, 0.85)
    // high garden (S1 reward)
    bigFlower(kit, 20.1, 1.0, -1.15, 1.1, kit.theme.leafPink)
    puffPlant(kit, 22.9, 1.0, -0.95, 0.9)
    lantern(kit, 24.6, 1.0, -0.8, 1.0)
    tree(kit, 19.6, -5.0, 1.05, true)
    // wide garden + burr zone
    crystal(kit, 34.2, 0.1, -1.15, 0.9, kit.theme.crystal)
    bush(kit, 35.6, 0.1, -1.0, 0.9)
    lantern(kit, 33.9, 0.1, -0.75, 0.9)
    // ferry crossing through the first ring gate
    ringGate(kit, 44.4, 3.3, 1.75)
    floatingRock(kit, 46.2, 4.8, -8.5, 0.9)
    floatingRock(kit, 40.8, 5.6, -10.5, 1.2)
    // ferry landing (CP2)
    puffPlant(kit, 51.6, 0.9, -1.05, 0.9)
    mushroom(kit, 53.4, 0.9, -0.95, 0.8)
    // chain zone
    crystal(kit, 61.4, -0.3, -1.15, 1.0, kit.theme.crystalGold)
    floatingRock(kit, 63.0, 3.8, -7.5, 0.85)
    // wide garden before the finale
    bigFlower(kit, 70.6, 1.3, -1.15, 1.05, kit.theme.leafPinkLight)
    tree(kit, 74.4, -5.4, 1.1)
    puffPlant(kit, 76.2, 1.3, -1.0, 0.85)
    // grand finale: the double-vine arc threads the second ring gate
    ringGate(kit, 91.2, 5.3, 1.6)
    floatingRock(kit, 85.6, 6.6, -9.5, 1.1)
    floatingRock(kit, 88.6, 5.6, -11, 0.9)
    // background suspension bridge between the high gardens
    ropeBridge(kit, 70.2, 2.7, 77.2, 2.5)
    // grand garden celebration
    bigFlower(kit, 91.0, 0.6, -1.2, 1.15, kit.theme.leafPink)
    bigFlower(kit, 96.6, 0.6, -1.35, 0.95, kit.theme.flowerC)
    puffPlant(kit, 93.6, 0.6, -0.95, 1.0)
    tree(kit, 90.6, -5.4, 1.05, true)
    lantern(kit, 95.2, 0.6, -0.75, 1.05)
    crystal(kit, 97.8, 0.6, -1.1, 1.15, kit.theme.crystal)
  },
}

// ============================ Level 5 — Starlit Hollow ============================
//
// V2 addition. A fifth and final region: a deep-indigo night glade lit by
// firefly lanterns and glowing crystal. Reuses every proven building block
// (climb swing, long vine, a mid-air 2-swing chain, a walk-on drifting
// stepping-stone, checkpoints, stars, a two-stage finale) and adds ONE
// genuinely new mechanic: the wisp swarm (LevelKit.wispSwarm) — an airborne
// hazard that drifts on an elliptical orbit (x AND y) instead of the thorn
// burr's ground-level back-and-forth sweep, so crossing it safely means
// reading its current position and timing a jump through the gap in its
// loop, not just running past it.
//
// Geometry below mirrors L4's verified gap sizes (same deltas between
// platform edges, swing x and mover center) rather than guessing fresh
// numbers, then was walked start-to-finish with the debug sim harness
// (see worklog) before any test scenario was written against it.

const L5: LevelDef = {
  id: 'hollow',
  name: 'Starlit Hollow',
  subtitle: 'The night chapter',
  hint: 'Watch the wisp swarm drift — time your jump through the gap in its loop.',
  region: 'Region E — Starlit Hollow',
  theme: 'hollow',
  spawnX: 0.4,
  flagX: 97.0,
  killY: -8,
  platforms: [
    { x1: -3.4, x2: 6.6, top: 0 }, // home glade, lantern-lit
    { x1: 9.0, x2: 12.6, top: 0.4 }, // teaching hop (2.4u gap, matches L4's proven teaching hop)
    { x1: 18.3, x2: 26.5, top: 1.0 }, // high hollow (S1 climb reward, CP1)
    { x1: 32.6, x2: 41.0, top: 0.1 }, // wide hollow — the wisp swarm drifts here (matches L4's P3 height so the walk-on height gap to the stepping-stone stays the same)
    { x1: 49.0, x2: 54.0, top: 0.85 }, // stepping-stone landing (CP2; wide left margin so the hop off the pad always lands past the checkpoint's +0.3u activation margin)
    { x1: 60.0, x2: 64.0, top: -0.3 }, // safe catch isle under the chain zone
    { x1: 69.0, x2: 77.3, top: 1.25 }, // wide hollow (CP3, S5 launch edge)
    { x1: 82.6, x2: 84.8, top: 4.1 }, // OPTIONAL shortcut isle (expert early S5 release, skips S6)
    { x1: 87.8, x2: 98.2, top: 0.6 }, // starlit grove + flag
  ],
  movers: [
    // drifting moonlit stepping-stone across the hollow gap — same proven
    // walk-on geometry as L4's ferry (top sits 0.02 above P4's edge).
    { cx: 44.4, top: 0.12, w: 3.0, motion: { axis: 'x', amp: 3.0, speed: 0.8, phase: 0 } },
  ],
  pedestals: [{ x: 15.6, top: -0.3 }],
  swings: [
    { x: 15.6, type: 'frame', baseY: -0.3, L: 3.2, pivotH: 4.1, range: 2.3 }, // S1 climb
    { x: 27.0, type: 'hanging', pivotY: 7.4, L: 4.8, range: 2.4 }, // S2 long vine
    { x: 56.8, type: 'frame', baseY: -0.4, L: 3.3, pivotH: 4.2, range: 2.3 }, // S3 → chain…
    { x: 64.8, type: 'hanging', pivotY: 7.0, L: 4.6, range: 2.4 }, // …onto S4
    // S5 finale vine 1 — pump hard, release at mid-arc and CHAIN mid-air
    // onto S6 (mirrors L4's proven double-vine finale, shifted -0.4)
    { x: 77.8, type: 'hanging', pivotY: 7.8, L: 4.9, range: 2.4 },
    // S6 finale gate swing — short ropes put its seat on the S5 flight line
    { x: 85.6, type: 'hanging', pivotY: 7.5, L: 3.2, range: 2.4 },
  ],
  checkpoints: [
    { x: 22.0, y: 1.0, plat: 2 },
    { x: 52.0, y: 0.85, plat: 4 },
    { x: 73.0, y: 1.25, plat: 6 },
  ],
  stars: [
    { x: 8.0, y: 2.4 }, // teaching hop apex
    { x: 18.6, y: 2.3 }, // S1 climb arc (post-release ascent)
    { x: 20.2, y: 2.4 }, // S1 climb arc (apex, just before landing descent)
    { x: 29.5, y: 3.6 }, // S2 arc
    { x: 44.4, y: 1.8 }, // the stepping-stone ride
    { x: 59.5, y: 2.6 }, // mid-air chain zone
    { x: 66.5, y: 3.2 }, // S4 arc
    { x: 91.5, y: 3.8 }, // finale arc
  ],
  wisps: [
    // the new hazard: an elliptical airborne orbit, x 35.2–37.8 / y 0.5–1.8,
    // slow enough to read (≈6.3s period) — wait for the low point to pass,
    // or time a jump through the high point.
    { x: 36.5, y: 1.15, radiusX: 1.3, radiusY: 0.65, speed: 1.0, phase: 0 },
  ],
  buildDecor(kit) {
    startSign(kit, 1.7, 0)
    tree(kit, 3.2, -5.0, 1.05)
    tree(kit, 6.0, -4.6, 0.9)
    lantern(kit, 2.4, 0, -1.1, 0.9)
    lantern(kit, 5.6, 0, -0.8, 1.0)
    mushroom(kit, 4.4, 0, -0.95, 0.8)
    bush(kit, 5.6, 0, -1.3, 0.9)
    // teaching hop
    crystal(kit, 10.8, 0.4, -1.0, 0.75, kit.theme.crystal)
    // high hollow (S1 reward, CP1)
    bigFlower(kit, 20.1, 1.0, -1.15, 1.05, kit.theme.leafPink)
    lantern(kit, 22.9, 1.0, -0.8, 1.0)
    crystal(kit, 24.9, 1.0, -0.95, 0.9, kit.theme.crystalGold)
    tree(kit, 19.6, -5.0, 1.0, true)
    // wide hollow — wisp swarm zone, lit by a ring of lanterns so the
    // hazard's orbit always reads against a bright backdrop
    lantern(kit, 33.4, 0.1, -0.85, 0.95)
    lantern(kit, 39.6, 0.1, -0.8, 0.9)
    crystal(kit, 36.0, 0.1, -1.2, 1.0, kit.theme.crystal)
    mushroom(kit, 34.6, 0.1, -1.0, 0.85)
    // stepping-stone crossing + ring gate
    ringGate(kit, 44.4, 3.1, 1.7)
    floatingRock(kit, 46.4, 4.6, -8.5, 0.9)
    floatingRock(kit, 41.4, 5.4, -10.5, 1.15)
    // stepping-stone landing (CP2)
    lantern(kit, 51.4, 0.85, -0.8, 0.95)
    mushroom(kit, 53.2, 0.85, -0.95, 0.8)
    // chain zone
    crystal(kit, 61.2, -0.3, -1.15, 1.0, kit.theme.crystalGold)
    floatingRock(kit, 62.8, 3.6, -7.5, 0.85)
    // wide hollow before the finale (CP3)
    bigFlower(kit, 70.6, 1.25, -1.15, 1.05, kit.theme.leafPinkLight)
    tree(kit, 74.4, -5.4, 1.1)
    lantern(kit, 76.2, 1.25, -0.8, 0.9)
    ropeBridge(kit, 70.2, 2.65, 77.0, 2.45)
    // finale: double-vine chain threads the ring gate (mirrors L4's grand
    // finale decor, shifted -0.4 to match the geometry shift)
    crystal(kit, 83.8, 4.1, -1.1, 0.85, kit.theme.crystal) // marks the optional shortcut isle
    ringGate(kit, 90.8, 5.3, 1.6)
    floatingRock(kit, 85.2, 6.6, -9.5, 1.1)
    floatingRock(kit, 88.2, 5.6, -11, 0.9)
    // starlit grove celebration
    bigFlower(kit, 90.6, 0.6, -1.2, 1.15, kit.theme.leafPink)
    bigFlower(kit, 96.2, 0.6, -1.35, 0.95, kit.theme.flowerC)
    lantern(kit, 94.8, 0.6, -0.85, 1.05)
    lantern(kit, 97.2, 0.6, -0.7, 0.9)
    crystal(kit, 97.9, 0.6, -1.1, 1.15, kit.theme.crystal)
    tree(kit, 90.2, -5.4, 1.05, true)
  },
}

export const LEVELS: LevelDef[] = [L1, L2, L3, L4, L5]
