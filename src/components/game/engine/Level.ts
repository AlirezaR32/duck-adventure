/**
 * Project Duck — the level (V0.4, one continuous fantasy route).
 *
 * Sections (deliberate difficulty curve):
 *   A  Warm-up        P1 → S1 (gap swing) → P2 ......... zero-pump landing
 *   B  Swing rhythm   S2 → P3 → S3 → P4 ................ light pumping
 *   C  Floating isles S4 → P5(low) → S5(hanging) → P6 → S6 → P7(high)
 *   D  Fantasy garden P8 (giant flora, waterfall) → S7(hanging) → P9 →
 *                     S8 → P9b bonus island (optional) / P10
 *   E  Finish         S9 grand finale → P11 (flag + arch + celebration)
 *
 * Play geometry (PLATFORMS/SWINGS/checkpoint pedestals) is fully separated
 * from decor: every flower, mushroom, crystal, lantern, rock and waterfall
 * lives behind the play plane or off the runway and never collides.
 */

import * as THREE from 'three'
import { PhysicsWorld } from './Physics'
import { roundedBoxGeo, type SwingCfg } from './Swing'

export interface PlatDef {
  x1: number
  x2: number
  top: number
}

export const PLATFORMS: PlatDef[] = [
  { x1: -3.4, x2: 7.4, top: 0 }, // A start
  { x1: 12.4, x2: 19.0, top: 0.1 }, // A landing (wide)
  { x1: 22.6, x2: 28.4, top: 0.4 }, // B rhythm
  { x1: 31.6, x2: 37.6, top: 0.9 }, // B landing
  { x1: 43.4, x2: 48.6, top: -0.4 }, // C low island
  { x1: 52.4, x2: 59.8, top: 0.7 }, // C mid island (wide: catches any S5 release)
  { x1: 60.4, x2: 65.0, top: 2.0 }, // C high island (crystals)
  { x1: 67.6, x2: 73.0, top: 0.9 }, // D garden
  { x1: 77.6, x2: 83.2, top: 2.0 }, // D mid
  { x1: 84.4, x2: 86.4, top: 3.2 }, // D bonus island (optional)
  { x1: 87.6, x2: 91.8, top: 0.6 }, // E pre-finish
  { x1: 96.0, x2: 103.6, top: 0.3 }, // E finish — flag here
]

export const SWINGS: SwingCfg[] = [
  // A — the friendly first swing, standing on a little rock pedestal
  { x: 10.0, type: 'frame', baseY: -0.35, L: 3.1, pivotH: 3.9, range: 2.3 },
  // B — rhythm swings stand on the platforms near their far edges
  { x: 16.8, type: 'frame', baseY: 0.1, L: 3.3, pivotH: 4.3 },
  { x: 26.6, type: 'frame', baseY: 0.4, L: 3.2, pivotH: 3.6 },
  // C — pedestal swing down to the low isle...
  { x: 40.4, type: 'frame', baseY: -0.5, L: 3.3, pivotH: 4.2 },
  // ...then a hanging vine swing over the wide gap (close enough to S4's
  // launch arc that a strong release can chain onto it MID-AIR)
  { x: 49.0, type: 'hanging', pivotY: 6.2, L: 4.7, range: 2.4 },
  { x: 55.4, type: 'frame', baseY: 0.7, L: 3.0, pivotH: 3.5 },
  // D — garden vine swing
  { x: 75.8, type: 'hanging', pivotY: 6.6, L: 4.5, range: 2.4 },
  { x: 81.2, type: 'frame', baseY: 2.0, L: 3.2, pivotH: 3.8 },
  // E — grand finale
  { x: 90.0, type: 'frame', baseY: 0.6, L: 3.5, pivotH: 4.2, range: 2.2 },
]

/** Checkpoint posts; the duck activates one by landing on its platform. */
export const CHECKPOINTS: { x: number; y: number; plat: number }[] = [
  { x: 15.5, y: 0.1, plat: 1 },
  { x: 25.4, y: 0.4, plat: 2 },
  { x: 34.2, y: 0.9, plat: 3 },
  { x: 45.8, y: -0.4, plat: 4 },
  { x: 54.2, y: 0.7, plat: 5 },
  { x: 61.8, y: 2.0, plat: 6 },
  { x: 69.8, y: 0.9, plat: 7 },
  { x: 79.4, y: 2.0, plat: 8 },
  { x: 88.5, y: 0.6, plat: 10 },
]

/** Optional collectible stars along reachable arcs. */
export const STARS: { x: number; y: number }[] = [
  { x: 13.8, y: 2.6 },
  { x: 20.8, y: 2.6 },
  { x: 30.2, y: 3.1 },
  { x: 38.9, y: 2.9 },
  { x: 44.8, y: 1.4 },
  { x: 50.2, y: 1.7 },
  { x: 59.5, y: 3.9 },
  { x: 60.8, y: 2.8 },
  { x: 66.2, y: 4.0 },
  { x: 80.2, y: 3.7 },
  { x: 79.8, y: 3.6 },
  { x: 85.4, y: 4.4 },
  { x: 93.4, y: 3.6 },
]

export const FLAG_X = 101.0
export const SPAWN = { x: 0.4 }
export const KILL_Y = -8

const GRASS_TOP = 0x7ecc5a
const GRASS_RIM = 0xb4e97c
const GRASS_SIDE = 0x59b04d
const DIRT = 0xb98050
const DIRT_DEEP = 0xa06a42
const OUTLINE = 0x503a2b
const WOOD = 0x9a6b4a
const WOOD_LIGHT = 0xe8c892
const LEAF = 0x5fb668
const LEAF_LIGHT = 0x83cf74
const LEAF_DEEP = 0x4f9e59
const LEAF_PINK = 0xf5a8c0
const LEAF_PINK_LIGHT = 0xffc9da
const FLOWER_A = 0xfff6ee
const FLOWER_B = 0xffb65c
const FLOWER_C = 0xff8ba0
const CRYSTAL = 0x9fd8e8
const CRYSTAL_GOLD = 0xffd166
const MUSHROOM_CAP = 0xf2848c
const ROCK_A = 0xc9c2e2
const ROCK_B = 0xb7d4c2
const VINE = 0x6faf5e

function flatMat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, flatShading: true })
}

function smoothMat(color: number, rough = 0.9): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 })
}

function glowMat(color: number, intensity = 0.7): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
    metalness: 0,
  })
}

/** Deterministic PRNG (mulberry32) so decor never flickers between loads. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Inverted-hull cartoon outline: same geometry, pushed out by world-space t. */
function addOutline(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  w: number,
  h: number,
  d: number,
  pos: [number, number, number],
  t = 0.05,
): void {
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide, fog: false }),
  )
  m.scale.set((w + 2 * t) / w, (h + 2 * t) / h, (d + 2 * t) / d)
  m.position.set(pos[0], pos[1], pos[2])
  parent.add(m)
}

export interface StarRef {
  x: number
  y: number
  mesh: THREE.Group
  taken: boolean
  phase: number
}

export interface LevelHandle {
  update: (t: number) => void
  stars: StarRef[]
  setCheckpointActive: (i: number) => void
}

// ============================ decor builders ============================

function makeTree(x: number, z: number, s: number, scene: THREE.Scene, pink = false): void {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.16 * s, 1.35 * s, 8), flatMat(WOOD))
  trunk.position.y = 0.67 * s
  trunk.castShadow = true
  g.add(trunk)
  const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.72 * s, 10, 8), flatMat(pink ? LEAF_PINK : LEAF))
  c1.position.y = 1.62 * s
  c1.castShadow = true
  g.add(c1)
  const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.48 * s, 9, 7), flatMat(pink ? LEAF_PINK : LEAF_DEEP))
  c2.position.set(-0.42 * s, 1.32 * s, 0.12)
  g.add(c2)
  const c3 = new THREE.Mesh(new THREE.SphereGeometry(0.44 * s, 9, 7), flatMat(pink ? LEAF_PINK_LIGHT : LEAF_LIGHT))
  c3.position.set(0.34 * s, 1.98 * s, -0.1)
  g.add(c3)
  g.position.set(x, 0, z)
  scene.add(g)
}

function makeBush(x: number, y: number, z: number, s: number, scene: THREE.Scene): void {
  const g = new THREE.Group()
  const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.34 * s, 9, 7), flatMat(LEAF))
  b1.position.set(0, 0.2 * s, 0)
  b1.scale.y = 0.75
  g.add(b1)
  const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.24 * s, 8, 6), flatMat(LEAF_LIGHT))
  b2.position.set(0.3 * s, 0.14 * s, 0.05)
  b2.scale.y = 0.7
  g.add(b2)
  g.position.set(x, y, z)
  scene.add(g)
}

function makeFlower(x: number, y: number, z: number, color: number, scene: THREE.Scene): void {
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.22, 5), flatMat(LEAF_DEEP))
  stem.position.set(x, y + 0.11, z)
  scene.add(stem)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 6), flatMat(color))
  head.position.set(x, y + 0.25, z)
  scene.add(head)
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), flatMat(0xffe9a8))
  heart.position.set(x, y + 0.27, z + 0.03)
  scene.add(heart)
}

/** §7 oversized flower — tall stem, ring of chunky petals, glowing heart. */
function makeBigFlower(x: number, y: number, z: number, s: number, petal: number, scene: THREE.Scene): void {
  const g = new THREE.Group()
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 1.1 * s, 7), flatMat(LEAF_DEEP))
  stem.position.y = 0.55 * s
  stem.castShadow = true
  g.add(stem)
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 8, 6), flatMat(LEAF))
  leaf.scale.set(1.5, 0.32, 0.7)
  leaf.position.set(0.2 * s, 0.5 * s, 0)
  leaf.rotation.z = 0.4
  g.add(leaf)
  const head = new THREE.Group()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 9, 7), flatMat(petal))
    p.position.set(Math.cos(a) * 0.26 * s, Math.sin(a) * 0.26 * s, 0)
    p.scale.z = 0.45
    head.add(p)
  }
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 10, 8), glowMat(0xffe9a8, 0.5))
  heart.position.z = 0.1 * s
  head.add(heart)
  head.position.y = 1.24 * s
  g.add(head)
  g.position.set(x, y, z)
  scene.add(g)
}

/** §7 whimsical mushroom — pastel cap with pale dots. */
function makeMushroom(x: number, y: number, z: number, s: number, scene: THREE.Scene): void {
  const g = new THREE.Group()
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.15 * s, 0.42 * s, 8), flatMat(0xfff3e0))
  stem.position.y = 0.21 * s
  g.add(stem)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 11, 8), flatMat(MUSHROOM_CAP))
  cap.position.y = 0.44 * s
  cap.scale.set(1.15, 0.72, 1.15)
  cap.castShadow = true
  g.add(cap)
  for (let i = 0; i < 3; i++) {
    const a = i * 2.2 + x
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 6, 5), flatMat(0xfff6ee))
    dot.position.set(Math.cos(a) * 0.2 * s, 0.56 * s, Math.sin(a) * 0.2 * s)
    dot.scale.y = 0.5
    g.add(dot)
  }
  g.position.set(x, y, z)
  scene.add(g)
}

/** §7 glowing crystal cluster (pulses via the returned mesh). */
function makeCrystal(x: number, y: number, z: number, s: number, color: number, scene: THREE.Scene): THREE.Mesh {
  const g = new THREE.Group()
  const mat = glowMat(color, 0.6)
  const main = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 * s, 0), mat)
  main.scale.set(0.75, 1.7, 0.75)
  main.position.y = 0.3 * s
  main.castShadow = true
  g.add(main)
  const side = new THREE.Mesh(new THREE.OctahedronGeometry(0.13 * s, 0), mat)
  side.scale.set(0.7, 1.3, 0.7)
  side.position.set(0.19 * s, 0.17 * s, 0.05)
  side.rotation.z = -0.42
  g.add(side)
  const side2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.1 * s, 0), mat)
  side2.scale.set(0.7, 1.2, 0.7)
  side2.position.set(-0.17 * s, 0.14 * s, -0.04)
  side2.rotation.z = 0.5
  g.add(side2)
  g.position.set(x, y, z)
  scene.add(g)
  return main
}

/** §7 pastel rock formation. */
function makeRock(x: number, y: number, z: number, s: number, color: number, scene: THREE.Scene): void {
  const g = new THREE.Group()
  const r1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 * s, 0), flatMat(color))
  r1.position.y = 0.16 * s
  r1.scale.set(1.2, 0.75, 1)
  r1.castShadow = true
  g.add(r1)
  const r2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.19 * s, 0), flatMat(color))
  r2.position.set(0.32 * s, 0.1 * s, 0.1)
  r2.scale.y = 0.7
  g.add(r2)
  g.position.set(x, y, z)
  scene.add(g)
}

/** §7 hanging lantern on a drooping vine (decor only). */
function makeLantern(x: number, y: number, z: number, drop: number, scene: THREE.Scene): void {
  const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, drop, 5), flatMat(VINE))
  vine.position.set(x, y - drop / 2, z)
  scene.add(vine)
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), flatMat(LEAF))
  leaf.scale.set(1.4, 0.4, 0.8)
  leaf.position.set(x + 0.06, y - drop * 0.45, z)
  scene.add(leaf)
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.085, 9, 7), glowMat(0xffd98a, 0.85))
  lamp.position.set(x, y - drop - 0.08, z)
  scene.add(lamp)
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.07, 7), flatMat(WOOD))
  cap.position.set(x, y - drop + 0.03, z)
  scene.add(cap)
}

/** Small pedestal island that also collides — a missed grab can recover here. */
function makePedestal(x: number, top: number, world: PhysicsWorld, scene: THREE.Scene): void {
  const capGeo = roundedBoxGeo(1.5, 0.34, 1.9, 0.15)
  const cap = new THREE.Mesh(capGeo, flatMat(GRASS_SIDE))
  cap.position.set(x, top - 0.18, 0)
  cap.castShadow = true
  cap.receiveShadow = true
  scene.add(cap)
  const rimGeo = roundedBoxGeo(1.5, 0.09, 2.0, 0.045)
  const rim = new THREE.Mesh(rimGeo, flatMat(GRASS_TOP))
  rim.position.set(x, top - 0.035, 0)
  rim.receiveShadow = true
  scene.add(rim)
  const coneH = 0.8
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.62, coneH, 8), smoothMat(DIRT_DEEP))
  cone.rotation.x = Math.PI
  cone.position.set(x, top - 0.35 - coneH / 2 + 0.1, 0)
  scene.add(cone)
  addOutline(scene, capGeo, 1.5, 0.34, 1.9, [x, top - 0.18, 0])
  world.add(x, top - 0.6, 1.5, 1.2)
}

// ============================ level build ============================

export function buildLevel(scene: THREE.Scene, world: PhysicsWorld): LevelHandle {
  const rand = rng(20260404)
  const H = 1.15 // collision body thickness under the cap
  const anims: Array<(t: number) => void> = []

  // ---- floating meadow-island platforms ----
  for (const p of PLATFORMS) {
    const w = p.x2 - p.x1
    const mid = (p.x1 + p.x2) / 2

    // grass cap (saturated green) + pale lit rim on top = readable edge
    const capGeo = roundedBoxGeo(w, 0.38, 2.7, 0.17)
    const cap = new THREE.Mesh(capGeo, flatMat(GRASS_SIDE))
    cap.position.set(mid, p.top - 0.21, 0)
    cap.castShadow = true
    cap.receiveShadow = true
    scene.add(cap)

    const rimGeo = roundedBoxGeo(w, 0.1, 2.8, 0.05)
    const rim = new THREE.Mesh(rimGeo, flatMat(GRASS_TOP))
    rim.position.set(mid, p.top - 0.05, 0)
    rim.receiveShadow = true
    scene.add(rim)

    // earth body + hanging island bottom
    const dirtGeo = roundedBoxGeo(w - 0.6, 1.0, 2.15, 0.2)
    const dirt = new THREE.Mesh(dirtGeo, smoothMat(DIRT))
    dirt.position.set(mid, p.top - 0.9, 0)
    dirt.receiveShadow = true
    scene.add(dirt)

    const coneH = Math.min(1.35, 0.55 + w * 0.075)
    const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.min(1.35, w * 0.24), coneH, 9), smoothMat(DIRT_DEEP))
    cone.rotation.x = Math.PI
    cone.rotation.y = rand() * 0.8
    cone.position.set(mid, p.top - 1.4 - coneH / 2, 0)
    scene.add(cone)

    // cartoon outlines around cap + dirt (sticker read against the hills)
    addOutline(scene, capGeo, w, 0.38, 2.7, [mid, p.top - 0.21, 0])
    addOutline(scene, dirtGeo, w - 0.6, 1.0, 2.15, [mid, p.top - 0.9, 0])

    // physics box (top surface exactly at p.top, matches the cap)
    world.add(mid, p.top - H / 2, w, H)

    // ---- low tufts + flowers on the platform (off the center runway) ----
    const n = Math.max(3, Math.floor(w / 1.6))
    const tuftGeo = new THREE.ConeGeometry(0.05, 0.2, 5)
    for (let i = 0; i < n; i++) {
      const x = p.x1 + 0.45 + rand() * (w - 0.9)
      const z = (rand() - 0.5) * 1.9
      const blades = 2 + Math.floor(rand() * 2)
      for (let b = 0; b < blades; b++) {
        const tuft = new THREE.Mesh(tuftGeo, flatMat(0x5aa84f))
        tuft.position.set(x + (rand() - 0.5) * 0.14, p.top + 0.08, z + (rand() - 0.5) * 0.12)
        tuft.rotation.z = (rand() - 0.5) * 0.4
        scene.add(tuft)
      }
      if (rand() > 0.45) {
        makeFlower(x + (rand() - 0.5) * 0.4, p.top, z > 0 ? z + 0.55 : z - 0.55, [FLOWER_A, FLOWER_B, FLOWER_C][Math.floor(rand() * 3)], scene)
      }
    }
  }

  // ---- swing pedestals (collidable recovery rocks in the gaps) ----
  makePedestal(10.0, -0.35, world, scene)
  makePedestal(40.4, -0.5, world, scene)

  // ---- left boundary wall (invisible) ----
  world.add(-3.9, 2, 0.8, 10)

  // ============================ SECTION DECOR ============================
  // Everything here is strictly behind the play plane (z < -2.4) or pinned
  // to platform back edges; none of it collides or covers a landing zone.

  // A — warm meadow
  makeTree(3.2, -5.0, 1.05, scene)
  makeTree(16.2, -5.4, 1.0, scene)
  makeBush(5.6, 0, -1.1, 0.95, scene)
  makeRock(6.4, 0.1, -1.25, 0.8, ROCK_B, scene)

  // B — a couple of pastel rocks + bushes between swings
  makeTree(24.2, -5.2, 0.92, scene)
  makeBush(32.6, 0.9, -1.05, 1.0, scene)
  makeRock(35.9, 0.9, -1.2, 0.9, ROCK_A, scene)
  makeRock(33.0, 0.9, -1.35, 0.6, ROCK_B, scene)

  // C — floating isles: crystals + lanterns + far trees
  makeCrystal(45.2, -0.4, -1.15, 0.9, CRYSTAL, scene)
  makeLantern(44.4, -0.4, -0.7, 1.15, scene)
  makeTree(50.8, -5.8, 1.15, scene)
  makeCrystal(62.9, 2.0, -1.05, 1.15, CRYSTAL, scene)
  const pulse2 = makeCrystal(61.0, 2.0, -1.3, 0.8, CRYSTAL_GOLD, scene)
  anims.push((t) => {
    const m = pulse2.material as THREE.MeshStandardMaterial
    m.emissiveIntensity = 0.65 + Math.sin(t * 2.1) * 0.3
  })
  makeRock(53.6, 0.7, -1.2, 0.7, ROCK_A, scene)

  // D — fantasy garden: oversized flora, mushrooms, waterfall, lanterns
  makeBigFlower(68.6, 0.9, -1.15, 1.15, LEAF_PINK, scene)
  makeBigFlower(71.6, 0.9, -1.35, 0.95, FLOWER_C, scene)
  makeBigFlower(78.8, 2.0, -1.2, 1.05, LEAF_PINK_LIGHT, scene)
  makeMushroom(69.4, 0.9, -0.85, 1.0, scene)
  makeMushroom(72.3, 0.9, -1.0, 0.75, scene)
  makeMushroom(80.0, 2.0, -0.9, 0.85, scene)
  makeTree(67.9, -5.4, 1.0, scene, true)
  makeTree(76.4, -5.9, 1.1, scene, true)
  makeLantern(85.1, 3.2, -0.75, 0.85, scene)
  makeLantern(85.9, 3.2, -1.05, 1.25, scene)

  // waterfall tumbling from a pastel rock shelf at the garden's left edge
  {
    const wx = 66.9
    const wy = 0.9
    makeRock(wx, wy, -1.5, 1.5, ROCK_B, scene)
    const fallGeo = new THREE.PlaneGeometry(0.42, 3.4)
    const fallMat = new THREE.MeshBasicMaterial({
      color: 0xdff6ff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
    const fall = new THREE.Mesh(fallGeo, fallMat)
    fall.position.set(wx + 0.3, wy - 1.7, -1.4)
    scene.add(fall)
    const drops: THREE.Mesh[] = []
    const dropGeo = new THREE.SphereGeometry(0.045, 6, 5)
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
    for (let i = 0; i < 5; i++) {
      const d = new THREE.Mesh(dropGeo, dropMat)
      d.position.set(wx + 0.3 + (rand() - 0.5) * 0.3, wy - 0.3 - i * 0.66, -1.3)
      drops.push(d)
      scene.add(d)
    }
    anims.push((t) => {
      fallMat.opacity = 0.42 + Math.sin(t * 1.7) * 0.08
      for (let i = 0; i < drops.length; i++) {
        drops[i].position.y -= (0.016 + i * 0.002)
        if (drops[i].position.y < wy - 3.4) drops[i].position.y = wy - 0.2
      }
    })
  }

  // E — finish arch + flag zone flowers
  {
    const ax = FLAG_X
    const topY = 0.3
    for (const s of [-1.35, 1.35]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.5, 8), flatMat(WOOD))
      post.position.set(ax + s, topY + 1.25, -1.15)
      post.castShadow = true
      scene.add(post)
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), glowMat(CRYSTAL_GOLD, 0.5))
      ball.position.set(ax + s, topY + 2.56, -1.15)
      scene.add(ball)
    }
    const beam = new THREE.Mesh(roundedBoxGeo(3.0, 0.18, 0.16, 0.08), flatMat(WOOD_LIGHT))
    beam.position.set(ax, topY + 2.42, -1.15)
    scene.add(beam)
    // little pennants under the beam
    const pennantCols = [0xff8ba0, 0xffd166, 0x9fd8e8, 0xb4e97c]
    const pennaGeo = new THREE.ConeGeometry(0.09, 0.26, 4)
    for (let i = 0; i < 6; i++) {
      const pen = new THREE.Mesh(pennaGeo, flatMat(pennantCols[i % 4]))
      pen.rotation.x = Math.PI
      pen.position.set(ax - 1.1 + i * 0.44, topY + 2.26, -1.15)
      scene.add(pen)
    }
    anims.push((t) => {
      beam.rotation.z = Math.sin(t * 1.4) * 0.012
    })
  }

  // ---- wooden arrow sign at the start ("this way →") ----
  {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.85, 7), flatMat(WOOD))
    post.position.set(1.7, 0.42, -0.85)
    post.castShadow = true
    scene.add(post)
    const board = new THREE.Mesh(roundedBoxGeo(0.95, 0.4, 0.09, 0.1), flatMat(WOOD_LIGHT))
    board.position.set(1.75, 0.78, -0.85)
    board.rotation.z = 0.04
    board.castShadow = true
    scene.add(board)
    const arrowShape = new THREE.Shape()
    arrowShape.moveTo(-0.16, 0.09)
    arrowShape.lineTo(0.05, 0.09)
    arrowShape.lineTo(0.05, 0.16)
    arrowShape.lineTo(0.22, 0)
    arrowShape.lineTo(0.05, -0.16)
    arrowShape.lineTo(0.05, -0.09)
    arrowShape.lineTo(-0.16, -0.09)
    arrowShape.closePath()
    const arrow = new THREE.Mesh(
      new THREE.ExtrudeGeometry(arrowShape, { depth: 0.03, bevelEnabled: false }),
      flatMat(0xb97f45),
    )
    arrow.position.set(1.62, 0.78, -0.79)
    scene.add(arrow)
  }

  // ---- checkpoint posts (crystal on a wooden stick; gold when active) ----
  const cpCrystals: THREE.MeshStandardMaterial[] = []
  for (let i = 0; i < CHECKPOINTS.length; i++) {
    const cp = CHECKPOINTS[i]
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.05, 7), flatMat(WOOD))
    post.position.set(cp.x, cp.y + 0.52, -0.95)
    post.castShadow = true
    scene.add(post)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xbfd4dd,
      emissive: 0x59a8c4,
      emissiveIntensity: 0.12,
      roughness: 0.35,
      metalness: 0,
    })
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), mat)
    gem.scale.set(0.8, 1.35, 0.8)
    gem.position.set(cp.x, cp.y + 1.2, -0.95)
    gem.castShadow = true
    scene.add(gem)
    cpCrystals.push(mat)
    anims.push((t) => {
      gem.rotation.y = t * 1.2 + i
    })
  }

  // ---- collectible stars ----
  const starShape = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 === 0 ? 0.19 : 0.085
    const px = Math.cos(a) * r
    const py = Math.sin(a) * r
    if (i === 0) starShape.moveTo(px, py)
    else starShape.lineTo(px, py)
  }
  starShape.closePath()
  const starGeo = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
  })
  starGeo.translate(0, 0, -0.035)
  const stars: StarRef[] = STARS.map((s, i) => {
    const g = new THREE.Group()
    const m = new THREE.Mesh(starGeo, glowMat(CRYSTAL_GOLD, 0.85))
    m.castShadow = true
    g.add(m)
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.27, 0.014, 6, 26),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.4, fog: false }),
    )
    g.add(halo)
    g.position.set(s.x, s.y, 0)
    scene.add(g)
    return { x: s.x, y: s.y, mesh: g, taken: false, phase: i * 1.7 }
  })

  // ---- finish flag (bright, clear end point) ----
  const flagMat = new THREE.MeshStandardMaterial({
    color: 0xff7043,
    roughness: 0.8,
    side: THREE.DoubleSide,
    flatShading: true,
  })
  const flagMesh = new THREE.Mesh(
    (() => {
      const s = new THREE.Shape()
      s.moveTo(0, 0)
      s.lineTo(0.66, 0.2)
      s.lineTo(0, 0.4)
      return new THREE.ShapeGeometry(s)
    })(),
    flagMat,
  )
  flagMesh.position.set(FLAG_X + 0.03, 1.38, 0)
  scene.add(flagMesh)
  {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.8, 8), flatMat(WOOD))
    pole.position.set(FLAG_X, 0.9, 0)
    pole.castShadow = true
    scene.add(pole)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), flatMat(0xffd166))
    ball.position.set(FLAG_X, 1.84, 0)
    scene.add(ball)
    makeFlower(FLAG_X - 0.7, 0.3, 0.7, FLOWER_B, scene)
    makeFlower(FLAG_X + 0.6, 0.3, -0.7, FLOWER_A, scene)
  }

  return {
    stars,
    setCheckpointActive: (i: number) => {
      const mat = cpCrystals[i]
      if (!mat) return
      mat.color.set(0xffe6a8)
      mat.emissive.set(CRYSTAL_GOLD)
      mat.emissiveIntensity = 0.95
    },
    update: (t: number) => {
      flagMesh.rotation.y = Math.sin(t * 2.2) * 0.24
      for (const s of stars) {
        if (s.taken) continue
        s.mesh.position.y = s.y + Math.sin(t * 2.1 + s.phase) * 0.08
        s.mesh.rotation.y = t * 1.7 + s.phase
      }
      for (const a of anims) a(t)
    },
  }
}
