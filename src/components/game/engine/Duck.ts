/**
 * Project Duck — the duck character.
 *
 * Visual identity is matched to the supplied reference image:
 * a white, faceted (flat-shaded low-poly) duck with a plump rounded body,
 * rounded head, bright orange beak, small black bead eyes (plus a tiny
 * catchlight so they read at phone size), folded wings, a perky tail and
 * short orange webbed feet.
 *
 * The whole model is procedural (three.js primitives) so it is a reusable,
 * dependency-free asset: `new Duck()` gives you `duck.root` to drop in any
 * scene. All animation is driven from outside state — never from physics.
 */

import * as THREE from 'three'

const C = {
  body: 0xfbf8f0, // warm white
  wing: 0xeee6d6, // folded wing shade
  beakUp: 0xffab3d,
  beakLow: 0xf0871c,
  feet: 0xf89a20,
  eye: 0x241f1b,
}

function flatMat(color: number, rough = 0.9): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: true })
}

function blob(r: number, sx: number, sy: number, sz: number, mat: THREE.Material, segW = 10, segH = 8): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, segW, segH), mat)
  m.scale.set(sx, sy, sz)
  m.castShadow = true
  return m
}

interface Particle {
  mesh: THREE.Mesh
  vx: number
  vy: number
  life: number
  max: number
}

export interface DuckFrame {
  vx: number // world-space horizontal velocity
  grounded: boolean
  swinging: boolean
  falling: boolean // airborne, moving down fast
  tilt: number // world-space rope tilt while swinging (rad), else 0
}

export class Duck {
  /** Physics anchor: root sits at the collider's bottom-center (feet). */
  readonly root = new THREE.Group()
  /** Visual facing: 1 = right, -1 = left. Rotation eases smoothly. */
  facing = 1

  private squash = new THREE.Group()
  private body = new THREE.Group()
  private head = new THREE.Group()
  private eyes: THREE.Group[] = []
  private feet: THREE.Mesh[] = []
  private wings: THREE.Mesh[] = []
  private tail: THREE.Mesh

  private matBody = flatMat(C.body)
  private matWing = flatMat(C.wing)
  private matBeak = flatMat(C.beakUp)
  private matBeakLow = flatMat(C.beakLow)
  private matFeet = flatMat(C.feet, 0.8)
  private matEye = new THREE.MeshStandardMaterial({ color: C.eye, roughness: 0.35, metalness: 0.1 })

  private dustGeo = new THREE.SphereGeometry(0.05, 6, 5)
  private particles: Particle[] = []

  private t = 0
  private runPhase = 0
  private lean = 0
  private sqY = 1 // squash/stretch scale-y, spring-driven
  private sqVel = 0
  private blinkIn = 2.2
  private blinkLeft = 0
  private sitBlend = 0
  private airBlend = 0

  constructor() {
    this.build()
  }

  private build(): void {
    this.root.add(this.squash)
    this.squash.add(this.body)

    // ---- torso: plump rounded body (reference silhouette) ----
    const torso = blob(0.32, 1.0, 0.95, 0.88, this.matBody)
    torso.position.set(0, 0.4, 0)
    this.body.add(torso)

    // chest bulge for the plump front
    const chest = blob(0.2, 1.0, 0.9, 0.9, this.matBody)
    chest.position.set(0.1, 0.34, 0)
    this.body.add(chest)

    // ---- perky tail ----
    this.tail = blob(0.11, 0.8, 0.62, 0.9, this.matBody)
    this.tail.position.set(-0.3, 0.52, 0)
    this.tail.rotation.z = 0.55
    this.body.add(this.tail)

    // ---- folded wings (faceted panels on the sides) ----
    for (const zs of [0.27, -0.27]) {
      const w = blob(0.17, 0.9, 0.78, 0.42, this.matWing)
      w.position.set(-0.02, 0.44, zs)
      w.rotation.z = zs > 0 ? -0.1 : 0.1
      this.wings.push(w)
      this.body.add(w)
    }

    // ---- head group: rounded head + orange beak + bead eyes ----
    this.head.position.set(0.07, 0.8, 0)
    const skull = blob(0.25, 1.02, 0.98, 1.0, this.matBody, 11, 9)
    this.head.add(skull)

    const beakUp = blob(0.12, 1.9, 0.5, 0.95, this.matBeak)
    beakUp.position.set(0.22, 0.02, 0)
    this.head.add(beakUp)
    const beakLow = blob(0.085, 1.6, 0.42, 0.8, this.matBeakLow)
    beakLow.position.set(0.19, -0.055, 0)
    this.head.add(beakLow)

    for (const zs of [0.155, -0.155]) {
      const g = new THREE.Group()
      g.position.set(0.135, 0.095, zs)
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), this.matEye)
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.013, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      )
      glow.position.set(0.014, 0.015, zs > 0 ? 0.018 : -0.018)
      g.add(bead, glow)
      this.head.add(g)
      this.eyes.push(g)
    }
    this.body.add(this.head)

    // ---- orange webbed feet (kept on `squash`, not `body`, so the run
    // bounce lifts the body while feet stay near the ground) ----
    const footGeo = new THREE.SphereGeometry(0.1, 8, 6)
    for (const zs of [0.13, -0.13]) {
      const f = new THREE.Mesh(footGeo, this.matFeet)
      f.scale.set(1.45, 0.34, 1.0)
      f.castShadow = true
      f.position.set(-0.11, 0.05, zs)
      this.squash.add(f)
      this.feet.push(f)
    }
  }

  // ---------------- expressive events (called by the controller) ----------------

  onJump(): void {
    this.sqVel = 3.4 // stretch impulse
  }
  onLand(fallSpeed: number): void {
    this.sqVel = -Math.min(9, 3.2 + fallSpeed * 0.42) // squash impulse
    this.dust(fallSpeed > 6 ? 4 : 2)
  }
  onGrab(): void {
    this.sqVel = 2.0
  }

  private dust(n: number): void {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        this.dustGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }),
      )
      m.position.set((Math.random() - 0.5) * 0.2, 0.06, (Math.random() - 0.5) * 0.24)
      this.particles.push({
        mesh: m,
        vx: (Math.random() - 0.5) * 1.6,
        vy: 0.6 + Math.random() * 0.8,
        life: 0.38,
        max: 0.38,
      })
      this.root.add(m)
    }
  }

  // ---------------- per-frame visual update ----------------

  update(dt: number, s: DuckFrame): void {
    this.t += dt

    // squash & stretch spring (visual only — collider untouched)
    const k = 240
    const c = 17
    this.sqVel += (-k * (this.sqY - 1) - c * this.sqVel) * dt
    this.sqY += this.sqVel * dt
    this.sqY = Math.min(1.32, Math.max(0.62, this.sqY))
    const sx = 1 + (1 - this.sqY) * 0.62
    this.squash.scale.set(sx, this.sqY, sx)

    // facing ease (visual flip only)
    const targetRot = this.facing === 1 ? 0 : Math.PI
    this.root.rotation.y += (targetRot - this.root.rotation.y) * Math.min(1, dt * 14)

    const speedAbs = Math.abs(s.vx)
    const localVx = s.vx * this.facing // velocity in facing space
    const runAmt = Math.min(1, speedAbs / 4.2)

    // pose blends
    this.sitBlend += ((s.swinging ? 1 : 0) - this.sitBlend) * Math.min(1, dt * 9)
    this.airBlend += ((s.grounded || s.swinging ? 0 : 1) - this.airBlend) * Math.min(1, dt * 9)

    // run cycle phase
    if (s.grounded && !s.swinging && speedAbs > 0.25) {
      this.runPhase += dt * (5 + speedAbs * 2.4)
    }
    const w = this.runPhase

    // body bounce + forward lean
    const bounce = s.grounded && !s.swinging ? Math.abs(Math.sin(w)) * 0.05 * runAmt : 0
    const leanTarget = s.swinging
      ? 0.1
      : Math.max(-0.16, Math.min(0.16, localVx * 0.035)) + (s.falling ? 0.05 : 0)
    this.lean += (leanTarget - this.lean) * Math.min(1, dt * 10)
    this.body.rotation.z = -this.lean + 0.1 * this.sitBlend
    this.body.position.y = bounce + 0.02 * this.sitBlend

    // gentle breathing while idle
    const idle = s.grounded && speedAbs < 0.25 && !s.swinging
    const breathe = idle ? Math.sin(this.t * 2.4) * 0.014 : 0
    this.body.scale.set(1 + breathe * 0.6, 1 + breathe, 1 + breathe * 0.6)

    // head bob / curiosity
    this.head.rotation.z = Math.sin(this.t * 2.4) * 0.02 + 0.06 * this.sitBlend

    // rope tilt while swinging (applied in facing space)
    this.squash.rotation.z = s.swinging ? -s.tilt * this.facing * 0.5 : 0

    // feet: walk cycle / air dangle / sit forward
    const stepAmp = 0.15 * runAmt
    const liftAmp = 0.075 * runAmt
    const standX = -0.11
    const sitX = 0.18
    const airX = -0.17
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i]
      const phase = w + (i === 0 ? 0 : Math.PI)
      const walkX = Math.sin(phase) * stepAmp
      const lift = Math.max(0, Math.sin(phase + Math.PI / 2)) * liftAmp
      const stand = new THREE.Vector3(standX + walkX, 0.05 + lift, i === 0 ? 0.13 : -0.13)
      const air = new THREE.Vector3(airX, 0.02 + Math.sin(this.t * 3 + i) * 0.015, i === 0 ? 0.13 : -0.13)
      const sit = new THREE.Vector3(sitX, 0.02, i === 0 ? 0.15 : -0.15)
      const target = stand.lerp(air, this.airBlend).lerp(sit, this.sitBlend)
      f.position.lerp(target, Math.min(1, dt * 22))
    }

    // wings: tiny run flutter / lifted in air / tucked when sitting
    const wingFlap =
      s.swinging ? 0.1 : s.grounded ? Math.abs(Math.sin(w)) * 0.14 * runAmt : 0.45
    for (let i = 0; i < 2; i++) {
      const wing = this.wings[i]
      const side = i === 0 ? 1 : -1
      wing.rotation.z = side * (-0.1 - wingFlap) * (i === 0 ? 1 : 1)
    }

    // blink (and wide eyes when falling)
    this.blinkIn -= dt
    if (this.blinkIn <= 0) {
      this.blinkLeft = 0.12
      this.blinkIn = 2 + Math.random() * 2.6
    }
    if (this.blinkLeft > 0) this.blinkLeft -= dt
    const eyeY = this.blinkLeft > 0 ? 0.12 : s.falling && !s.swinging ? 1.3 : 1
    for (const e of this.eyes) e.scale.y += (eyeY - e.scale.y) * Math.min(1, dt * 30)

    // dust particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      if (p.life <= 0) {
        this.root.remove(p.mesh)
        ;(p.mesh.material as THREE.Material).dispose()
        this.particles.splice(i, 1)
        continue
      }
      p.vy -= 5 * dt
      p.mesh.position.x += p.vx * dt
      p.mesh.position.y += p.vy * dt
      const mat = p.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 0.75 * (p.life / p.max)
      p.mesh.scale.setScalar(1 + (1 - p.life / p.max) * 1.2)
    }
  }
}
