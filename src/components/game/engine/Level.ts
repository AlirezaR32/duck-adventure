/**
 * Project Duck V0.6 — level runtime.
 *
 * A LevelDef (see levels.ts) is instantiated into the scene here: play
 * geometry collides, decor never does, and everything lives under one root
 * group so a level can be unloaded cleanly (dispose traverses the root).
 */

import * as THREE from 'three'
import type { PhysicsWorld } from './Physics'
import type { SwingCfg } from './Swing'
import {
  checkpointPost,
  finishArch,
  finishFlag,
  glowMat,
  island,
  movingPlatform,
  pedestal,
  rng,
  starGeometry,
  THEMES,
  thornBurr,
  type HazardRT,
  type Kit,
  type MoverBuild,
  type PlatDef,
} from './LevelKit'
import type { CheckpointDef, LevelDef } from './levels'

export type { PlatDef } from './LevelKit'
export type { LevelDef, CheckpointDef } from './levels'
export type { SwingCfg } from './Swing'

export interface StarRef {
  x: number
  y: number
  mesh: THREE.Group
  taken: boolean
  phase: number
}

export interface LevelHandle {
  def: LevelDef
  root: THREE.Group
  stars: StarRef[]
  platforms: PlatDef[]
  checkpoints: CheckpointDef[]
  movers: MoverBuild[]
  /** Live hazard instances (collision positions come from their groups). */
  hazards: HazardRT[]
  update: (t: number) => void
  setCheckpointActive: (i: number) => void
  dispose: () => void
}

export function buildLevelRuntime(scene: THREE.Scene, world: PhysicsWorld, def: LevelDef): LevelHandle {
  const theme = THEMES[def.theme]
  const kit: Kit = {
    root: new THREE.Group(),
    world,
    theme,
    rand: rng(hash(def.id)),
    anims: [],
  }
  scene.add(kit.root)

  // ---- platforms + swing pedestals + movers (all collidable) ----
  for (const p of def.platforms) island(kit, p)
  for (const ped of def.pedestals) pedestal(kit, ped.x, ped.top)
  const movers = def.movers.map((m) => movingPlatform(kit, m.cx, m.top, m.w, m.motion))
  const hazards: HazardRT[] = (def.hazards ?? []).map((h) => thornBurr(kit, h))

  // ---- left boundary wall (invisible) ----
  world.add(def.spawnX - 3.8, 2, 0.8, 10)

  // ---- level-specific decor (never collides) ----
  def.buildDecor(kit)

  // ---- checkpoint posts ----
  const cpMaterials: THREE.MeshStandardMaterial[] = def.checkpoints.map((cp) =>
    checkpointPost(kit, cp.x, cp.y),
  )

  // ---- collectible stars ----
  const starGeo = starGeometry()
  const stars: StarRef[] = def.stars.map((s, i) => {
    const g = new THREE.Group()
    const m = new THREE.Mesh(starGeo, glowMat(theme.crystalGold, 0.85))
    m.castShadow = true
    g.add(m)
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.27, 0.014, 6, 26),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.4, fog: false }),
    )
    g.add(halo)
    g.position.set(s.x, s.y, 0)
    kit.root.add(g)
    return { x: s.x, y: s.y, mesh: g, taken: false, phase: i * 1.7 }
  })

  // ---- finish flag + arch ----
  const finishTop = def.platforms[def.platforms.length - 1].top
  const flag = finishFlag(kit, def.flagX, finishTop)
  finishArch(kit, def.flagX, finishTop)

  return {
    def,
    root: kit.root,
    stars,
    platforms: def.platforms,
    checkpoints: def.checkpoints,
    movers,
    hazards,
    setCheckpointActive: (i: number) => {
      const mat = cpMaterials[i]
      if (!mat) return
      mat.color.set(0xffe6a8)
      mat.emissive.set(theme.crystalGold)
      mat.emissiveIntensity = 0.95
    },
    update: (t: number) => {
      flag.rotation.y = Math.sin(t * 2.2) * 0.24
      for (const s of stars) {
        if (s.taken) continue
        s.mesh.position.y = s.y + Math.sin(t * 2.1 + s.phase) * 0.08
        s.mesh.rotation.y = t * 1.7 + s.phase
      }
      for (const a of kit.anims) a(t)
    },
    dispose: () => {
      scene.remove(kit.root)
      kit.root.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else if (mat) mat.dispose()
      })
      kit.root.clear()
    },
  }
}

/** Small string hash so each level keeps a stable decor seed. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
