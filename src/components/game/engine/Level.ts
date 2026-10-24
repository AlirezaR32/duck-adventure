/**
 * Project Duck — the first test level (Phase 8).
 *
 * A short side-scrolling course: starting platform, a few gaps, one or two
 * low obstacles, one swing, a safe landing platform and a clear end flag.
 * Platforms are two-tone (grass cap + honey dirt body) with rounded edges;
 * decorations are deterministic so every load looks identical.
 */

import * as THREE from 'three'
import { PhysicsWorld } from './Physics'
import { roundedBoxGeo } from './Swing'

export interface PlatDef {
  x1: number
  x2: number
  top: number
}

export const PLATFORMS: PlatDef[] = [
  { x1: -3.2, x2: 6.2, top: 0 }, // start
  { x1: 8.6, x2: 13.4, top: 0 }, // gap 1
  { x1: 16.0, x2: 20.6, top: 0.35 }, // gap 2, step up (obstacle here)
  { x1: 22.8, x2: 28.4, top: 0 }, // gap 3
  { x1: 30.4, x2: 36.2, top: 0 }, // swing platform
  { x1: 40.1, x2: 46.9, top: -0.35 }, // swing landing — gap is too wide for a plain jump, the swing is required
  { x1: 49.6, x2: 52.0, top: 0.3 }, // little step
  { x1: 54.2, x2: 60.8, top: 0 }, // finish
]

export const SWING_X = 35.0
export const OBSTACLE_X = 19.4
export const FLAG_X = 58.0
export const SPAWN = { x: 0.6, y: 0.31 }
export const KILL_Y = -7

const GRASS = 0x7cb85c
const GRASS_DARK = 0x5e9444
const DIRT = 0xc99058
const DIRT_DARK = 0xb97f49
const WOOD = 0x9a6b4a
const LEAF_A = 0x6fae52
const LEAF_B = 0x7dbe5f
const FLOWER_A = 0xfff6ee
const FLOWER_B = 0xffb65c

function flatMat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, flatShading: true })
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

export function buildLevel(scene: THREE.Scene, world: PhysicsWorld): { update: (t: number) => void } {
  const grassMat = flatMat(GRASS)
  const dirtMat = flatMat(DIRT)
  const tuftMat = flatMat(GRASS_DARK)
  const petalA = new THREE.MeshStandardMaterial({ color: FLOWER_A, roughness: 0.8, flatShading: true })
  const petalB = new THREE.MeshStandardMaterial({ color: FLOWER_B, roughness: 0.8, flatShading: true })
  const rand = rng(20260101)

  const H = 1.6 // platform body thickness

  // ---- platforms ----
  for (const p of PLATFORMS) {
    const w = p.x2 - p.x1
    const mid = (p.x1 + p.x2) / 2

    const cap = new THREE.Mesh(roundedBoxGeo(w, 0.34, 2.7, 0.16), grassMat)
    cap.position.set(mid, p.top - 0.17, 0)
    cap.castShadow = true
    cap.receiveShadow = true
    scene.add(cap)

    const bodyMesh = new THREE.Mesh(roundedBoxGeo(w - 0.3, H, 2.3, 0.18), dirtMat)
    bodyMesh.position.set(mid, p.top - 0.34 - H / 2 + 0.06, 0)
    bodyMesh.receiveShadow = true
    scene.add(bodyMesh)

    // physics box (top surface exactly at p.top)
    world.add(mid, p.top - H / 2, w, H)

    // grass tufts + flowers
    const tuftGeo = new THREE.ConeGeometry(0.05, 0.22, 5)
    const n = Math.max(2, Math.floor(w / 1.4))
    for (let i = 0; i < n; i++) {
      const x = p.x1 + 0.4 + rand() * (w - 0.8)
      const z = (rand() - 0.5) * 1.8
      const blades = 2 + Math.floor(rand() * 2)
      for (let b = 0; b < blades; b++) {
        const tuft = new THREE.Mesh(tuftGeo, tuftMat)
        tuft.position.set(x + (rand() - 0.5) * 0.14, p.top + 0.09, z + (rand() - 0.5) * 0.12)
        tuft.rotation.z = (rand() - 0.5) * 0.4
        scene.add(tuft)
      }
      if (rand() > 0.55) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 5), tuftMat)
        stem.position.set(x, p.top + 0.1, z > 0 ? z - 0.5 : z + 0.5)
        scene.add(stem)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), rand() > 0.5 ? petalA : petalB)
        head.position.set(x, p.top + 0.22, z > 0 ? z - 0.5 : z + 0.5)
        scene.add(head)
      }
    }
  }

  // ---- low obstacle on platform 3 (hop over it) ----
  {
    const top = 0.35
    const stone = new THREE.Mesh(roundedBoxGeo(0.6, 0.55, 1.5, 0.14), flatMat(0xdcb98c))
    stone.position.set(OBSTACLE_X, top + 0.275, 0)
    stone.castShadow = true
    stone.receiveShadow = true
    scene.add(stone)
    world.add(OBSTACLE_X, top + 0.275, 0.6, 0.55)
  }

  // ---- left boundary wall (invisible) ----
  world.add(-3.7, 2, 0.8, 10)

  // ---- trees behind the play plane ----
  const trunkMat = flatMat(WOOD)
  const leafA = flatMat(LEAF_A)
  const leafB = flatMat(LEAF_B)
  const trees: Array<[number, number, number]> = [
    [4.8, -1.6, 1.0],
    [24.5, -1.8, 1.15],
    [44.2, -1.6, 0.95],
    [56.5, -1.7, 1.1],
  ]
  for (const [x, z, s] of trees) {
    const g = new THREE.Group()
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.17 * s, 1.3 * s, 7), trunkMat)
    trunk.position.y = 0.65 * s
    trunk.castShadow = true
    g.add(trunk)
    const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.78 * s, 9, 7), leafA)
    c1.position.y = 1.55 * s
    c1.castShadow = true
    g.add(c1)
    const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.5 * s, 8, 6), leafB)
    c2.position.set(0.4 * s, 1.15 * s, 0.15)
    g.add(c2)
    g.position.set(x, 0, z)
    scene.add(g)
  }

  // ---- end flag (clear end point) ----
  const flagMesh = new THREE.Mesh(
    (() => {
      const s = new THREE.Shape()
      s.moveTo(0, 0)
      s.lineTo(0.62, 0.18)
      s.lineTo(0, 0.36)
      return new THREE.ShapeGeometry(s)
    })(),
    new THREE.MeshStandardMaterial({ color: 0xff8a5c, roughness: 0.8, side: THREE.DoubleSide, flatShading: true }),
  )
  flagMesh.position.set(FLAG_X + 0.03, 1.32, 0)
  scene.add(flagMesh)
  {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.7, 7), trunkMat)
    pole.position.set(FLAG_X, 0.85, 0)
    pole.castShadow = true
    scene.add(pole)
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), grassMat)
    base.position.set(FLAG_X, 0.06, 0)
    scene.add(base)
  }

  return {
    update: (t: number) => {
      flagMesh.rotation.y = Math.sin(t * 2.2) * 0.22
    },
  }
}
