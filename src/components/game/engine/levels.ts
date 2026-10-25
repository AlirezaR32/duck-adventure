/**
 * Project Duck V0.6 — level definitions (pure data + decor placement).
 *
 * Three short, complete levels demonstrating the swing core:
 *   1  Meadow Swing     — teach run / jump / grab / pump / release
 *   2  Floating Isles   — reward momentum, higher+lower routes, a mid-air
 *                         chain pair, optional stars on the brave line
 *   3  Crystal Canyon   — demanding: moving stone slabs, narrow fair
 *                         landings, a checkpoint right before the hardest
 *                         climb + grand finale
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
  rock,
  startSign,
  tree,
  waterfall,
} from './LevelKit'

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
  theme: 'meadow' | 'isles' | 'canyon'
  spawnX: number
  flagX: number
  killY: number
  platforms: PlatDef[]
  movers: MoverDef[]
  pedestals: { x: number; top: number }[]
  swings: SwingCfg[]
  checkpoints: CheckpointDef[]
  stars: { x: number; y: number }[]
  buildDecor: (kit: Kit) => void
}

// ============================ Level 1 — Meadow Swing ============================

const L1: LevelDef = {
  id: 'meadow',
  name: 'Meadow Swing',
  subtitle: 'Learn the ropes',
  hint: 'Run with the arrows, JUMP the gap, then GRAB the swing!',
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
  theme: 'canyon',
  spawnX: 0.4,
  flagX: 71.0,
  killY: -8,
  platforms: [
    { x1: -3.2, x2: 6.6, top: 0 }, // start ledge
    { x1: 12.8, x2: 17.2, top: 1.0 }, // narrow but fair
    { x1: 24.2, x2: 31.4, top: 0.5 }, // slab-side isle
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
    // grand landing garden
    tree(kit, 68.6, -5.4, 1.0)
    bush(kit, 70.0, 0.3, -1.05, 0.95)
    flower(kit, 69.4, 0.3, 0.75, kit.theme.flowerB)
    flower(kit, 72.4, 0.3, -0.7, kit.theme.flowerA)
  },
}

export const LEVELS: LevelDef[] = [L1, L2, L3]
