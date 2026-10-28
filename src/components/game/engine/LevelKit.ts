/**
 * Project Duck V0.6/V0.8 — reusable level component kit.
 *
 * Every playable object (island, pedestal, mover, checkpoint post, star,
 * flag, arch, sign) and every decor piece (tree, bush, flower, mushroom,
 * crystal, rock, lantern, waterfall, floating rock) is built by a small
 * function operating on a theme palette, so a new level is just data plus
 * a decor placement function.
 *
 * V0.8 adds the cloud-garden theme, fantasy landmarks (suspended ring
 * gates, glowing puff plants, background rope bridges) and the first
 * real hazard: the thorn burr — a slow, loud, forgiving patroller.
 *
 * Play geometry always collides; decor never does. Everything a level
 * builds lives under one root group so a level can be unloaded cleanly.
 */

import * as THREE from 'three'
import { PhysicsWorld, type Box, type MotionDef } from './Physics'
import { roundedBoxGeo } from './Swing'

// ============================ themes ============================

export interface LevelTheme {
  name: 'meadow' | 'isles' | 'canyon' | 'garden' | 'hollow'
  grassTop: number
  grassRim: number
  grassSide: number
  dirt: number
  dirtDeep: number
  outline: number
  tuft: number
  wood: number
  woodLight: number
  leaf: number
  leafLight: number
  leafDeep: number
  leafPink: number
  leafPinkLight: number
  crystal: number
  crystalGold: number
  rockA: number
  rockB: number
  flowerA: number
  flowerB: number
  flowerC: number
  mushroomCap: number
  vine: number
}

export const THEMES: Record<LevelTheme['name'], LevelTheme> = {
  meadow: {
    name: 'meadow',
    grassTop: 0x7ecc5a,
    grassRim: 0xb4e97c,
    grassSide: 0x59b04d,
    dirt: 0xb98050,
    dirtDeep: 0xa06a42,
    outline: 0x503a2b,
    tuft: 0x5aa84f,
    wood: 0x9a6b4a,
    woodLight: 0xe8c892,
    leaf: 0x5fb668,
    leafLight: 0x83cf74,
    leafDeep: 0x4f9e59,
    leafPink: 0xf5a8c0,
    leafPinkLight: 0xffc9da,
    crystal: 0x9fd8e8,
    crystalGold: 0xffd166,
    rockA: 0xc9c2e2,
    rockB: 0xb7d4c2,
    flowerA: 0xfff6ee,
    flowerB: 0xffb65c,
    flowerC: 0xff8ba0,
    mushroomCap: 0xf2848c,
    vine: 0x6faf5e,
  },
  isles: {
    name: 'isles',
    grassTop: 0x6fd39a,
    grassRim: 0xa8f0c8,
    grassSide: 0x4aa878,
    dirt: 0x9aa8b8,
    dirtDeep: 0x8290a4,
    outline: 0x3a4450,
    tuft: 0x54b080,
    wood: 0x8f7a5e,
    woodLight: 0xdcd0b0,
    leaf: 0x62c488,
    leafLight: 0x8fe0a8,
    leafDeep: 0x4fa878,
    leafPink: 0xf5b8d0,
    leafPinkLight: 0xffd4e4,
    crystal: 0xa8e4f0,
    crystalGold: 0xffd166,
    rockA: 0xcfd8e8,
    rockB: 0xb8e0d8,
    flowerA: 0xfff9f2,
    flowerB: 0xffc46a,
    flowerC: 0xff9ab4,
    mushroomCap: 0xef9aae,
    vine: 0x64b887,
  },
  canyon: {
    name: 'canyon',
    grassTop: 0xf2b45c,
    grassRim: 0xffd98a,
    grassSide: 0xd8824a,
    dirt: 0xb06248,
    dirtDeep: 0x96503c,
    outline: 0x4a2c26,
    tuft: 0xd89858,
    wood: 0x8a5a42,
    woodLight: 0xe0b084,
    leaf: 0x7cae6a,
    leafLight: 0xa4c88a,
    leafDeep: 0x5f9455,
    leafPink: 0xf0a890,
    leafPinkLight: 0xffc8b0,
    crystal: 0x8fe0d8,
    crystalGold: 0xffc46a,
    rockA: 0xe0a48a,
    rockB: 0xd89070,
    flowerA: 0xfff2e0,
    flowerB: 0xffa050,
    flowerC: 0xff7a70,
    mushroomCap: 0xe87a6a,
    vine: 0x8aa058,
  },
  // Region D — Cloud Garden: mint grass caps on lavender cloud-rock,
  // glowing pink/violet flora. Platforms stay saturated with dark
  // violet outlines so the white duck never blends into the pastels.
  garden: {
    name: 'garden',
    grassTop: 0xb2eed2,
    grassRim: 0xdcfce8,
    grassSide: 0x82d4b0,
    dirt: 0xcfc4ec,
    dirtDeep: 0xb2a5da,
    outline: 0x5c4a78,
    tuft: 0x74c8a4,
    wood: 0xa8845e,
    woodLight: 0xf0dcbc,
    leaf: 0x8fd8b8,
    leafLight: 0xbdf0d4,
    leafDeep: 0x64b890,
    leafPink: 0xf5b8e0,
    leafPinkLight: 0xffd8f0,
    crystal: 0xe8a8f0,
    crystalGold: 0xffd166,
    rockA: 0xd8d0f0,
    rockB: 0xc4e8de,
    flowerA: 0xfff2fa,
    flowerB: 0xff9ed8,
    flowerC: 0xc0a2ff,
    mushroomCap: 0xe89ac8,
    vine: 0x8fc4a8,
  },
  // Region E — starlit night glade: deep indigo dusk, firefly-gold glow
  // accents on dusky teal-blue grass. Platforms stay saturated against the
  // night sky so the white duck still reads clearly after dark.
  hollow: {
    name: 'hollow',
    grassTop: 0x3f6b8a,
    grassRim: 0x6fa8c2,
    grassSide: 0x2d4f68,
    dirt: 0x5c4a78,
    dirtDeep: 0x463a5c,
    outline: 0x201a34,
    tuft: 0x4a7e92,
    wood: 0x4a3a52,
    woodLight: 0xcba8d8,
    leaf: 0x4a7e92,
    leafLight: 0x72aec2,
    leafDeep: 0x3a6478,
    leafPink: 0xc89ae0,
    leafPinkLight: 0xe0c0f2,
    crystal: 0xffe28a,
    crystalGold: 0xffd166,
    rockA: 0x6a5c8a,
    rockB: 0x4a7e92,
    flowerA: 0xfff0d2,
    flowerB: 0xffb85c,
    flowerC: 0xc89ae0,
    mushroomCap: 0xffb85c,
    vine: 0x4a7e92,
  },
}

// ============================ kit context ============================

export interface Kit {
  root: THREE.Group
  world: PhysicsWorld
  theme: LevelTheme
  rand: () => number
  anims: Array<(t: number) => void>
}

export interface PlatDef {
  x1: number
  x2: number
  top: number
}

export interface MoverBuild {
  box: Box
  group: THREE.Group
}

// ============================ materials ============================

export function flatMat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, flatShading: true })
}

export function smoothMat(color: number, rough = 0.9): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 })
}

export function glowMat(color: number, intensity = 0.7): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
    metalness: 0,
  })
}

/** Deterministic PRNG (mulberry32) so decor never flickers between loads. */
export function rng(seed: number): () => number {
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
export function addOutline(
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
    new THREE.MeshBasicMaterial({ color: 0x503a2b, side: THREE.BackSide, fog: false }),
  )
  m.scale.set((w + 2 * t) / w, (h + 2 * t) / h, (d + 2 * t) / d)
  m.position.set(pos[0], pos[1], pos[2])
  parent.add(m)
}

// ============================ play geometry ============================

/** Floating island platform: grass cap + lit rim + earth body + hanging cone bottom. */
export function island(kit: Kit, p: PlatDef): void {
  const { root, world, theme, rand } = kit
  const w = p.x2 - p.x1
  const mid = (p.x1 + p.x2) / 2
  const H = 1.15 // collision body thickness under the cap

  const capGeo = roundedBoxGeo(w, 0.38, 2.7, 0.17)
  const cap = new THREE.Mesh(capGeo, flatMat(theme.grassSide))
  cap.position.set(mid, p.top - 0.21, 0)
  cap.castShadow = true
  cap.receiveShadow = true
  root.add(cap)

  const rimGeo = roundedBoxGeo(w, 0.1, 2.8, 0.05)
  const rim = new THREE.Mesh(rimGeo, flatMat(theme.grassTop))
  rim.position.set(mid, p.top - 0.05, 0)
  rim.receiveShadow = true
  root.add(rim)

  const dirtGeo = roundedBoxGeo(w - 0.6, 1.0, 2.15, 0.2)
  const dirt = new THREE.Mesh(dirtGeo, smoothMat(theme.dirt))
  dirt.position.set(mid, p.top - 0.9, 0)
  dirt.receiveShadow = true
  root.add(dirt)

  const coneH = Math.min(1.35, 0.55 + w * 0.075)
  const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.min(1.35, w * 0.24), coneH, 9), smoothMat(theme.dirtDeep))
  cone.rotation.x = Math.PI
  cone.rotation.y = rand() * 0.8
  cone.position.set(mid, p.top - 1.4 - coneH / 2, 0)
  root.add(cone)

  addOutline(root, capGeo, w, 0.38, 2.7, [mid, p.top - 0.21, 0])
  addOutline(root, dirtGeo, w - 0.6, 1.0, 2.15, [mid, p.top - 0.9, 0])

  world.add(mid, p.top - H / 2, w, H)

  // low tufts + flowers on the platform (off the center runway)
  const n = Math.max(3, Math.floor(w / 1.6))
  const tuftGeo = new THREE.ConeGeometry(0.05, 0.2, 5)
  const tuftMat = flatMat(theme.tuft)
  for (let i = 0; i < n; i++) {
    const x = p.x1 + 0.45 + rand() * (w - 0.9)
    const z = (rand() - 0.5) * 1.9
    const blades = 2 + Math.floor(rand() * 2)
    for (let b = 0; b < blades; b++) {
      const tuft = new THREE.Mesh(tuftGeo, tuftMat)
      tuft.position.set(x + (rand() - 0.5) * 0.14, p.top + 0.08, z + (rand() - 0.5) * 0.12)
      tuft.rotation.z = (rand() - 0.5) * 0.4
      root.add(tuft)
    }
    if (rand() > 0.45) {
      flower(kit, x + (rand() - 0.5) * 0.4, p.top, z > 0 ? z + 0.55 : z - 0.55, [theme.flowerA, theme.flowerB, theme.flowerC][Math.floor(rand() * 3)])
    }
  }
}

/** Small pedestal island that also collides — a missed grab can recover here. */
export function pedestal(kit: Kit, x: number, top: number): void {
  const { root, world, theme } = kit
  const capGeo = roundedBoxGeo(1.5, 0.34, 1.9, 0.15)
  const cap = new THREE.Mesh(capGeo, flatMat(theme.grassSide))
  cap.position.set(x, top - 0.18, 0)
  cap.castShadow = true
  cap.receiveShadow = true
  root.add(cap)
  const rimGeo = roundedBoxGeo(1.5, 0.09, 2.0, 0.045)
  const rim = new THREE.Mesh(rimGeo, flatMat(theme.grassTop))
  rim.position.set(x, top - 0.035, 0)
  rim.receiveShadow = true
  root.add(rim)
  const coneH = 0.8
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.62, coneH, 8), smoothMat(theme.dirtDeep))
  cone.rotation.x = Math.PI
  cone.position.set(x, top - 0.35 - coneH / 2 + 0.1, 0)
  root.add(cone)
  addOutline(root, capGeo, 1.5, 0.34, 1.9, [x, top - 0.18, 0])
  world.add(x, top - 0.6, 1.5, 1.2)
}

/**
 * Moving platform: floating stone slab on a sinusoidal path (see Physics).
 * The returned box drives the visual group every update tick.
 */
export function movingPlatform(kit: Kit, cx: number, top: number, w: number, motion: MotionDef): MoverBuild {
  const { root, world, theme } = kit
  const g = new THREE.Group()
  const h = 0.5
  const capGeo = roundedBoxGeo(w, h, 2.2, 0.16)
  const cap = new THREE.Mesh(capGeo, flatMat(theme.rockB))
  cap.castShadow = true
  cap.receiveShadow = true
  g.add(cap)
  const rimGeo = roundedBoxGeo(w + 0.08, 0.12, 2.3, 0.055)
  const rim = new THREE.Mesh(rimGeo, flatMat(theme.rockA))
  rim.position.y = h / 2 - 0.02
  rim.receiveShadow = true
  g.add(rim)
  const coneH = 0.7
  const cone = new THREE.Mesh(new THREE.ConeGeometry(w * 0.32, coneH, 8), smoothMat(theme.dirtDeep))
  cone.rotation.x = Math.PI
  cone.position.y = -h / 2 - coneH / 2 + 0.12
  g.add(cone)
  addOutline(g, capGeo, w, h, 2.2, [0, 0, 0])
  // two little crystals pinned to the rim mark it as magical
  const gemMat = glowMat(theme.crystal, 0.55)
  for (const s of [-1, 1]) {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), gemMat)
    gem.scale.set(0.8, 1.3, 0.8)
    gem.position.set(s * (w / 2 - 0.18), h / 2 + 0.08, 0.85)
    g.add(gem)
  }
  root.add(g)

  const H = 1.15
  const box = world.addMoving(cx, top - H / 2, w, H, motion)
  // align the VISUAL cap top with the collision top (the cap is 0.5 thick,
  // the collision body 1.15 — without this offset the duck would hover)
  const yOff = (H - h) / 2
  g.position.set(cx, top - H / 2 + yOff, 0)
  kit.anims.push(() => {
    g.position.x = box.cx
    g.position.y = box.cy + yOff
  })
  return { box, group: g }
}

/** Checkpoint post: crystal on a wooden stick; gold when active. Returns its material. */
export function checkpointPost(kit: Kit, x: number, y: number): THREE.MeshStandardMaterial {
  const { root, theme } = kit
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.05, 7), flatMat(theme.wood))
  post.position.set(x, y + 0.52, -0.95)
  post.castShadow = true
  root.add(post)
  const mat = new THREE.MeshStandardMaterial({
    color: 0xbfd4dd,
    emissive: 0x59a8c4,
    emissiveIntensity: 0.12,
    roughness: 0.35,
    metalness: 0,
  })
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), mat)
  gem.scale.set(0.8, 1.35, 0.8)
  gem.position.set(x, y + 1.2, -0.95)
  gem.castShadow = true
  root.add(gem)
  kit.anims.push((t) => {
    gem.rotation.y = t * 1.2 + x
  })
  return mat
}

/** Shared collectible star geometry (built once per level). */
export function starGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 === 0 ? 0.19 : 0.085
    const px = Math.cos(a) * r
    const py = Math.sin(a) * r
    if (i === 0) shape.moveTo(px, py)
    else shape.lineTo(px, py)
  }
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
  })
  geo.translate(0, 0, -0.035)
  return geo
}

/** Wooden arrow sign at the start ("this way →"). */
export function startSign(kit: Kit, x: number, y: number): void {
  const { root, theme } = kit
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.85, 7), flatMat(theme.wood))
  post.position.set(x, y + 0.42, -0.85)
  post.castShadow = true
  root.add(post)
  const board = new THREE.Mesh(roundedBoxGeo(0.95, 0.4, 0.09, 0.1), flatMat(theme.woodLight))
  board.position.set(x + 0.05, y + 0.78, -0.85)
  board.rotation.z = 0.04
  board.castShadow = true
  root.add(board)
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
    flatMat(theme.wood),
  )
  arrow.position.set(x - 0.08, y + 0.78, -0.79)
  root.add(arrow)
}

/** Finish flag (bright, clear end point). Returns the waving cloth mesh. */
export function finishFlag(kit: Kit, x: number, topY: number): THREE.Mesh {
  const { root, theme } = kit
  const flagMat = new THREE.MeshStandardMaterial({
    color: 0xff7043,
    roughness: 0.8,
    side: THREE.DoubleSide,
    flatShading: true,
  })
  const flag = new THREE.Mesh(
    (() => {
      const s = new THREE.Shape()
      s.moveTo(0, 0)
      s.lineTo(0.66, 0.2)
      s.lineTo(0, 0.4)
      return new THREE.ShapeGeometry(s)
    })(),
    flagMat,
  )
  flag.position.set(x + 0.03, topY + 1.08, 0)
  root.add(flag)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.8, 8), flatMat(theme.wood))
  pole.position.set(x, topY + 0.6, 0)
  pole.castShadow = true
  root.add(pole)
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), flatMat(theme.crystalGold))
  ball.position.set(x, topY + 1.54, 0)
  root.add(ball)
  flower(kit, x - 0.7, topY, 0.7, theme.flowerB)
  flower(kit, x + 0.6, topY, -0.7, theme.flowerA)
  return flag
}

/** Celebration arch over the finish. */
export function finishArch(kit: Kit, x: number, topY: number): void {
  const { root, theme } = kit
  for (const s of [-1.35, 1.35]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.5, 8), flatMat(theme.wood))
    post.position.set(x + s, topY + 1.25, -1.15)
    post.castShadow = true
    root.add(post)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), glowMat(theme.crystalGold, 0.5))
    ball.position.set(x + s, topY + 2.56, -1.15)
    root.add(ball)
  }
  const beam = new THREE.Mesh(roundedBoxGeo(3.0, 0.18, 0.16, 0.08), flatMat(theme.woodLight))
  beam.position.set(x, topY + 2.42, -1.15)
  root.add(beam)
  const cols = [theme.flowerC, theme.crystalGold, theme.crystal, theme.grassRim]
  const penGeo = new THREE.ConeGeometry(0.09, 0.26, 4)
  for (let i = 0; i < 6; i++) {
    const pen = new THREE.Mesh(penGeo, flatMat(cols[i % 4]))
    pen.rotation.x = Math.PI
    pen.position.set(x - 1.1 + i * 0.44, topY + 2.26, -1.15)
    root.add(pen)
  }
  kit.anims.push((t) => {
    beam.rotation.z = Math.sin(t * 1.4) * 0.012
  })
}

// ============================ decor (never collides) ============================

export function tree(kit: Kit, x: number, z: number, s: number, pink = false): void {
  const { root, theme } = kit
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.16 * s, 1.35 * s, 8), flatMat(theme.wood))
  trunk.position.y = 0.67 * s
  trunk.castShadow = true
  g.add(trunk)
  const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.72 * s, 10, 8), flatMat(pink ? theme.leafPink : theme.leaf))
  c1.position.y = 1.62 * s
  c1.castShadow = true
  g.add(c1)
  const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.48 * s, 9, 7), flatMat(pink ? theme.leafPink : theme.leafDeep))
  c2.position.set(-0.42 * s, 1.32 * s, 0.12)
  g.add(c2)
  const c3 = new THREE.Mesh(new THREE.SphereGeometry(0.44 * s, 9, 7), flatMat(pink ? theme.leafPinkLight : theme.leafLight))
  c3.position.set(0.34 * s, 1.98 * s, -0.1)
  g.add(c3)
  g.position.set(x, 0, z)
  root.add(g)
}

export function bush(kit: Kit, x: number, y: number, z: number, s: number): void {
  const { root, theme } = kit
  const g = new THREE.Group()
  const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.34 * s, 9, 7), flatMat(theme.leaf))
  b1.position.set(0, 0.2 * s, 0)
  b1.scale.y = 0.75
  g.add(b1)
  const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.24 * s, 8, 6), flatMat(theme.leafLight))
  b2.position.set(0.3 * s, 0.14 * s, 0.05)
  b2.scale.y = 0.7
  g.add(b2)
  g.position.set(x, y, z)
  root.add(g)
}

export function flower(kit: Kit, x: number, y: number, z: number, color: number): void {
  const { root, theme } = kit
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.22, 5), flatMat(theme.leafDeep))
  stem.position.set(x, y + 0.11, z)
  root.add(stem)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 6), flatMat(color))
  head.position.set(x, y + 0.25, z)
  root.add(head)
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), flatMat(0xffe9a8))
  heart.position.set(x, y + 0.27, z + 0.03)
  root.add(heart)
}

/** Oversized flower — tall stem, ring of chunky petals, glowing heart. */
export function bigFlower(kit: Kit, x: number, y: number, z: number, s: number, petal: number): void {
  const { root, theme } = kit
  const g = new THREE.Group()
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 1.1 * s, 7), flatMat(theme.leafDeep))
  stem.position.y = 0.55 * s
  stem.castShadow = true
  g.add(stem)
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 8, 6), flatMat(theme.leaf))
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
  root.add(g)
}

/** Whimsical mushroom — pastel cap with pale dots. */
export function mushroom(kit: Kit, x: number, y: number, z: number, s: number): void {
  const { root, theme } = kit
  const g = new THREE.Group()
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.15 * s, 0.42 * s, 8), flatMat(0xfff3e0))
  stem.position.y = 0.21 * s
  g.add(stem)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 11, 8), flatMat(theme.mushroomCap))
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
  root.add(g)
}

/** Glowing crystal cluster (returns the main shard so it can pulse). */
export function crystal(kit: Kit, x: number, y: number, z: number, s: number, color?: number): THREE.Mesh {
  const { root, theme } = kit
  const g = new THREE.Group()
  const mat = glowMat(color ?? theme.crystal, 0.6)
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
  root.add(g)
  return main
}

/** Pastel rock formation. */
export function rock(kit: Kit, x: number, y: number, z: number, s: number, color?: number): void {
  const { root, theme } = kit
  const g = new THREE.Group()
  const c = color ?? theme.rockA
  const r1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 * s, 0), flatMat(c))
  r1.position.y = 0.16 * s
  r1.scale.set(1.2, 0.75, 1)
  r1.castShadow = true
  g.add(r1)
  const r2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.19 * s, 0), flatMat(c))
  r2.position.set(0.32 * s, 0.1 * s, 0.1)
  r2.scale.y = 0.7
  g.add(r2)
  g.position.set(x, y, z)
  root.add(g)
}

/** Hanging lantern on a drooping vine (decor only). */
export function lantern(kit: Kit, x: number, y: number, z: number, drop: number): void {
  const { root, theme } = kit
  const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, drop, 5), flatMat(theme.vine))
  vine.position.set(x, y - drop / 2, z)
  root.add(vine)
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), flatMat(theme.leaf))
  leaf.scale.set(1.4, 0.4, 0.8)
  leaf.position.set(x + 0.06, y - drop * 0.45, z)
  root.add(leaf)
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.085, 9, 7), glowMat(0xffd98a, 0.85))
  lamp.position.set(x, y - drop - 0.08, z)
  root.add(lamp)
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.07, 7), flatMat(theme.wood))
  cap.position.set(x, y - drop + 0.03, z)
  root.add(cap)
}

/** Waterfall tumbling from a pastel rock shelf (animated). */
export function waterfall(kit: Kit, x: number, y: number): void {
  const { root, rand } = kit
  rock(kit, x, y, -1.5, 1.5, kit.theme.rockB)
  const fallGeo = new THREE.PlaneGeometry(0.42, 3.4)
  const fallMat = new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.5, depthWrite: false })
  const fall = new THREE.Mesh(fallGeo, fallMat)
  fall.position.set(x + 0.3, y - 1.7, -1.4)
  root.add(fall)
  const drops: THREE.Mesh[] = []
  const dropGeo = new THREE.SphereGeometry(0.045, 6, 5)
  const dropMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
  for (let i = 0; i < 5; i++) {
    const d = new THREE.Mesh(dropGeo, dropMat)
    d.position.set(x + 0.3 + (rand() - 0.5) * 0.3, y - 0.3 - i * 0.66, -1.3)
    drops.push(d)
    root.add(d)
  }
  kit.anims.push((t) => {
    fallMat.opacity = 0.42 + Math.sin(t * 1.7) * 0.08
    for (let i = 0; i < drops.length; i++) {
      drops[i].position.y -= 0.016 + i * 0.002
      if (drops[i].position.y < y - 3.4) drops[i].position.y = y - 0.2
    }
  })
}

// ============================ V0.8 — hazards & fantasy landmarks ============================

/** Slow patrolling hazard: hover center (x, y), sinus patrol and speed. */
export interface HazardDef {
  x: number
  y: number
  travel: number
  speed: number
  phase?: number
  /** Ground-ring height override (defaults to y − 0.58). */
  ringY?: number
}

export interface HazardRT {
  def: HazardDef
  group: THREE.Group
  /** Collision radius (forgiving: slightly smaller than the visuals). */
  r: number
}

/**
 * Thorn burr — the game's first real hazard. Slow, loud, impossible to
 * misread: deep plum spiky ball, pulsing danger ring projected on the
 * ground below it, gentle bob. Always placed on a wide platform with room
 * to run past or jump over, always after a recent checkpoint.
 */
export function thornBurr(kit: Kit, def: HazardDef): HazardRT {
  const { root } = kit
  const g = new THREE.Group()

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x7a3b5e,
    emissive: 0x40182e,
    emissiveIntensity: 0.55,
    roughness: 0.5,
    metalness: 0,
    flatShading: true,
  })
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), coreMat)
  g.add(core)

  const spikeGeo = new THREE.ConeGeometry(0.085, 0.32, 5)
  const spikeMat = flatMat(0x93507a)
  const dirs: [number, number, number][] = []
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    dirs.push([Math.cos(a), 0, Math.sin(a)])
  }
  dirs.push([0, 1, 0.2], [0.7, 0.75, -0.3], [-0.7, 0.75, 0.3])
  dirs.push([0, -1, 0.2], [0.7, -0.75, -0.3], [-0.7, -0.75, 0.3])
  for (const [dx, dy, dz] of dirs) {
    const s = new THREE.Mesh(spikeGeo, spikeMat)
    s.position.set(dx * 0.28, dy * 0.28, dz * 0.28)
    s.quaternion.setFromUnitVectors(UP, new THREE.Vector3(dx, dy, dz).normalize())
    s.castShadow = true
    g.add(s)
  }

  // danger ring projected on the ground under the burr — the honest
  // "this zone is unsafe" marker, pulsing so it reads at a glance
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xe05078, transparent: true, opacity: 0.35, fog: false })
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.74, 26), ringMat)
  ring.rotation.x = -Math.PI / 2
  const ringY = def.ringY ?? def.y - 0.58 // platform surface right under the hover center
  ring.position.set(def.x, ringY, 0)
  root.add(ring)

  root.add(g)
  const phase = def.phase ?? 0
  kit.anims.push((t) => {
    const cx = def.x + Math.sin(t * def.speed + phase) * def.travel
    g.position.set(cx, def.y + Math.sin(t * 1.7 + phase) * 0.05, 0)
    g.rotation.y = t * 0.9
    core.rotation.x = t * 1.35
    ring.position.x = cx
    ringMat.opacity = 0.3 + Math.sin(t * 4.2 + phase) * 0.14
  })

  return { def, group: g, r: 0.62 }
}

/** An airborne hazard that drifts on an elliptical orbit (x AND y), unlike
 * the thorn burr's ground-level back-and-forth patrol. */
export interface OrbitHazardDef {
  x: number
  y: number
  radiusX: number
  radiusY: number
  speed: number
  phase?: number
}

/**
 * Starlit wisp swarm — Region E's new hazard. A small cluster of glowing
 * motes orbiting a dark thorned core on an ellipse that crosses the route,
 * so passing it safely means reading its current position and timing a
 * swing release or jump through the gap in its loop, not just dodging a
 * straight-line sweep like the thorn burr. A soft pulsing aura (billboard
 * ring, always facing the camera) stands in for the thorn burr's
 * ground-projected danger ring since this hazard is airborne.
 */
export function wispSwarm(kit: Kit, def: OrbitHazardDef): HazardRT {
  const { root } = kit
  const g = new THREE.Group()

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x2e2650,
    emissive: 0x241c40,
    emissiveIntensity: 0.6,
    roughness: 0.55,
    metalness: 0,
    flatShading: true,
  })
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), coreMat)
  g.add(core)

  const moteGeo = new THREE.SphereGeometry(0.07, 10, 8)
  const moteMat = new THREE.MeshBasicMaterial({ color: 0xffe28a, fog: false })
  const motes: THREE.Mesh[] = []
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(moteGeo, moteMat)
    motes.push(m)
    g.add(m)
  }

  // soft aura halo — always faces the camera (billboard via lookAt in anims)
  const auraMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.3, fog: false })
  const aura = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.58, 22), auraMat)
  g.add(aura)

  root.add(g)
  const phase = def.phase ?? 0
  kit.anims.push((t) => {
    const cx = def.x + Math.cos(t * def.speed + phase) * def.radiusX
    const cy = def.y + Math.sin(t * def.speed + phase) * def.radiusY
    g.position.set(cx, cy, 0)
    core.rotation.y = t * 1.1
    core.rotation.x = t * 0.7
    auraMat.opacity = 0.22 + Math.sin(t * 3.6 + phase) * 0.12
    for (let i = 0; i < motes.length; i++) {
      const a = t * 2.2 + (i / motes.length) * Math.PI * 2
      motes[i].position.set(Math.cos(a) * 0.3, Math.sin(a * 1.3) * 0.22, Math.sin(a) * 0.3)
    }
  })

  return { def: { x: def.x, y: def.y, travel: 0, speed: 0 }, group: g, r: 0.52 }
}

const UP = new THREE.Vector3(0, 1, 0)

/**
 * Giant suspended ring — a magical flight-path landmark. Purely decor:
 * it frames the arcs the duck actually flies (ferry rides, vine chains),
 * teaching the route without a single word of UI.
 */
export function ringGate(kit: Kit, x: number, y: number, r: number): void {
  const { root, theme } = kit
  const mat = new THREE.MeshStandardMaterial({
    color: theme.leafPinkLight,
    emissive: theme.leafPink,
    emissiveIntensity: 0.5,
    roughness: 0.45,
    metalness: 0,
  })
  const torus = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 10, 44), mat)
  torus.position.set(x, y, 0)
  root.add(torus)
  const gemGeo = new THREE.OctahedronGeometry(0.09, 0)
  const gems: THREE.Mesh[] = []
  for (let i = 0; i < 3; i++) {
    const gem = new THREE.Mesh(gemGeo, glowMat(theme.crystal, 0.8))
    root.add(gem)
    gems.push(gem)
  }
  kit.anims.push((t) => {
    torus.rotation.z = t * 0.18
    for (let i = 0; i < gems.length; i++) {
      const a = t * 0.5 + (i / gems.length) * Math.PI * 2
      gems[i].position.set(x + Math.cos(a) * (r + 0.32), y + Math.sin(a) * (r + 0.32), 0.25)
    }
  })
}

/** Glowing puff plant — unusual cloud-garden flora (decor only). */
export function puffPlant(kit: Kit, x: number, y: number, z: number, s: number): void {
  const { root, theme, rand } = kit
  const g = new THREE.Group()
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s, 0.035 * s, 0.5 * s, 6), flatMat(theme.leafDeep))
  stem.position.y = 0.25 * s
  g.add(stem)
  const puffMat = new THREE.MeshStandardMaterial({
    color: 0xfff4fb,
    emissive: theme.leafPink,
    emissiveIntensity: 0.35,
    roughness: 0.6,
    metalness: 0,
  })
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rand() * 0.5
    const p = new THREE.Mesh(new THREE.SphereGeometry((0.09 + rand() * 0.05) * s, 8, 7), puffMat)
    p.position.set(Math.cos(a) * 0.12 * s, 0.55 * s + Math.sin(a) * 0.07 * s, Math.sin(a) * 0.1 * s)
    g.add(p)
  }
  g.position.set(x, y, z)
  root.add(g)
  const ph = rand() * 6.28
  kit.anims.push((t) => {
    puffMat.emissiveIntensity = 0.3 + Math.sin(t * 1.6 + ph) * 0.16
    g.rotation.z = Math.sin(t * 0.8 + ph) * 0.05
  })
}

/**
 * Decorative suspension bridge far behind the play plane (never collides).
 * Planks are one InstancedMesh, rails are two tube curves: 5 draw calls.
 */
export function ropeBridge(kit: Kit, x1: number, y1: number, x2: number, y2: number): void {
  const { root, theme } = kit
  const z = -1.5
  const sag = 0.55
  const span = Math.abs(x2 - x1)
  const n = Math.max(6, Math.round(span / 0.6))
  const plankMat = flatMat(theme.wood)
  const plankGeo = roundedBoxGeo(0.4, 0.07, 0.85, 0.03)
  const planks = new THREE.InstancedMesh(plankGeo, plankMat, n)
  const m4 = new THREE.Matrix4()
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n
    const x = x1 + (x2 - x1) * f
    const y = y1 + (y2 - y1) * f - Math.sin(f * Math.PI) * sag
    m4.makeTranslation(x, y, z)
    planks.setMatrixAt(i, m4)
  }
  planks.instanceMatrix.needsUpdate = true
  root.add(planks)
  for (let i = 0; i <= 8; i++) {
    const f = i / 8
    pts.push(new THREE.Vector3(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f - Math.sin(f * Math.PI) * sag + 0.36 - Math.sin(f * Math.PI) * 0.1, 0))
  }
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.85 })
  for (const dz of [-0.44, 0.44]) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, p.y, z + dz)))
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.024, 5, false), ropeMat)
    root.add(rail)
  }
  for (const [px, py] of [
    [x1, y1],
    [x2, y2],
  ]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.0, 7), plankMat)
    post.position.set(px, py + 0.42, z)
    root.add(post)
  }
}

/** Small floating rock island drifting in the background (gently bobs). */
export function floatingRock(kit: Kit, x: number, y: number, z: number, s: number): void {
  const { root, theme } = kit
  const g = new THREE.Group()
  const capGeo = roundedBoxGeo(1.6 * s, 0.5 * s, 1.4 * s, 0.2 * s)
  const cap = new THREE.Mesh(capGeo, flatMat(theme.grassSide))
  g.add(cap)
  const coneH = 1.0 * s
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.7 * s, coneH, 7), smoothMat(theme.dirtDeep))
  cone.rotation.x = Math.PI
  cone.position.y = -0.25 * s - coneH / 2
  g.add(cone)
  addOutline(g, capGeo, 1.6 * s, 0.5 * s, 1.4 * s, [0, 0, 0])
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1 * s, 0), glowMat(theme.crystal, 0.5))
  gem.scale.set(0.8, 1.4, 0.8)
  gem.position.set(0.4 * s, 0.32 * s, 0.2)
  g.add(gem)
  g.position.set(x, y, z)
  root.add(g)
  const phase = kit.rand() * 6.28
  kit.anims.push((t) => {
    g.position.y = y + Math.sin(t * 0.7 + phase) * 0.18
    g.rotation.y = Math.sin(t * 0.3 + phase) * 0.08
  })
}
