/**
 * Project Duck — the level (V0.2, swing-first reconstruction).
 *
 * Layout: start platform → SWING A over a gap that is too wide to jump →
 * landing platform → SWING B over a wider gap → final landing with the flag.
 * Rhythm: run → jump → grab → swing → release → fly → land → repeat.
 *
 * Platforms are floating meadow islands, deliberately separated from the
 * background: bright two-tone grass caps with a pale lit rim, warm earth
 * bodies, soft hanging island bottoms, dark warm outlines — nothing shares
 * a silhouette or color with the pale parallax hills behind them.
 * Decorations (trees, bushes, flowers, sign) live strictly behind the play
 * plane (z < -2.6) and never collide.
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
  { x1: -3.4, x2: 7.4, top: 0 }, // start
  { x1: 12.6, x2: 19.4, top: 0.1 }, // after swing A
  { x1: 25.2, x2: 33.8, top: -0.2 }, // after swing B — flag here
]

export const SWINGS: SwingCfg[] = [
  { x: 10.0, baseY: 0, L: 3.1, pivotH: 3.55 },
  { x: 22.3, baseY: 0.1, L: 3.35, pivotH: 4.1 },
]

export const FLAG_X = 31.7
export const MOUND_X = 29.4
export const SPAWN = { x: 0.4 }
export const KILL_Y = -8

const GRASS_TOP = 0x7ecc5a
const GRASS_RIM = 0xb4e97c
const GRASS_SIDE = 0x59b04d
const DIRT = 0xb98050
const DIRT_DEEP = 0xa06a42
const OUTLINE = 0x503a2b
const SAND = 0xdcb98c
const WOOD = 0x9a6b4a
const LEAF = 0x5fb668
const LEAF_LIGHT = 0x83cf74
const LEAF_DEEP = 0x4f9e59
const FLOWER_A = 0xfff6ee
const FLOWER_B = 0xffb65c
const FLOWER_C = 0xff8ba0

function flatMat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, flatShading: true })
}

function smoothMat(color: number, rough = 0.9): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 })
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

function makeTree(x: number, z: number, s: number, scene: THREE.Scene): void {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.16 * s, 1.35 * s, 8), flatMat(WOOD))
  trunk.position.y = 0.67 * s
  trunk.castShadow = true
  g.add(trunk)
  const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.72 * s, 10, 8), flatMat(LEAF))
  c1.position.y = 1.62 * s
  c1.castShadow = true
  g.add(c1)
  const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.48 * s, 9, 7), flatMat(LEAF_DEEP))
  c2.position.set(-0.42 * s, 1.32 * s, 0.12)
  g.add(c2)
  const c3 = new THREE.Mesh(new THREE.SphereGeometry(0.44 * s, 9, 7), flatMat(LEAF_LIGHT))
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

export function buildLevel(scene: THREE.Scene, world: PhysicsWorld): { update: (t: number) => void } {
  const rand = rng(20260202)
  const H = 1.15 // collision body thickness under the cap

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

    // ---- decor ON the platform (kept low + off the center runway) ----
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
    // bushes at the back edge
    if (rand() > 0.35) makeBush(p.x1 + 0.9 + rand() * (w - 1.8), p.top, -1.05, 0.9 + rand() * 0.4, scene)
  }

  // ---- little sandy mound before the flag (a final joyful hop) ----
  {
    const moundGeo = roundedBoxGeo(1.05, 0.52, 1.7, 0.24)
    const mound = new THREE.Mesh(moundGeo, flatMat(SAND))
    mound.position.set(MOUND_X, PLATFORMS[2].top + 0.24, 0)
    mound.castShadow = true
    mound.receiveShadow = true
    scene.add(mound)
    world.add(MOUND_X, PLATFORMS[2].top + 0.24, 1.05, 0.52)
  }

  // ---- left boundary wall (invisible) ----
  world.add(-3.9, 2, 0.8, 10)

  // ---- trees + bushes strictly behind the play plane (deep enough that
  // they never fight the duck for attention on landing zones) ----
  const trees: Array<[number, number, number]> = [
    [3.2, -5.0, 1.05],
    [20.6, -5.6, 1.15],
    [24.9, -5.2, 0.95],
    [33.6, -5.8, 1.1],
  ]
  for (const [x, z, s] of trees) makeTree(x, z, s, scene)

  // ---- wooden arrow sign at the start ("this way →") ----
  {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.85, 7), flatMat(WOOD))
    post.position.set(1.7, 0.42, -0.85)
    post.castShadow = true
    scene.add(post)
    const board = new THREE.Mesh(roundedBoxGeo(0.95, 0.4, 0.09, 0.1), flatMat(0xe8c892))
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
    makeFlower(FLAG_X - 0.7, PLATFORMS[2].top, 0.7, FLOWER_B, scene)
    makeFlower(FLAG_X + 0.6, PLATFORMS[2].top, -0.7, FLOWER_A, scene)
  }

  return {
    update: (t: number) => {
      flagMesh.rotation.y = Math.sin(t * 2.2) * 0.24
    },
  }
}
