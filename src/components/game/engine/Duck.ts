/**
 * Project Duck — the duck character (V0.2 redesign).
 *
 * Visual identity matched to the supplied duck-ornament reference:
 * a smooth, collectible-toy white duck with a LONG elegant neck, a softly
 * rounded head, a compact elongated body, tiny folded wings, a glossy dark
 * bead eye with catchlight, a bright orange-yellow beak and small orange
 * webbed feet.
 *
 * The model is built from smooth swept surfaces (lathe profiles + a custom
 * tapered tube for the neck) — deliberately NOT a stack of visible primitive
 * spheres/cubes. All animation is procedural and driven from outside state;
 * the physics collider lives in Physics/Game and never sees any of this.
 */

import * as THREE from 'three'

const C = {
  body: 0xfdfaf1, // warm toy white
  wing: 0xf2ebda, // folded wing shade
  beak: 0xffa63e, // bright orange-yellow
  beakLow: 0xf1881e, // lower mandible
  feet: 0xfc9a26, // orange feet
  eye: 0x201a16, // glossy near-black
}

function toyMat(color: number, rough = 0.58): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: rough,
    metalness: 0,
    clearcoat: 0.32,
    clearcoatRoughness: 0.55,
  })
}

/**
 * Smooth tube swept along a Catmull-Rom path with a radius that varies
 * linearly across the `radii` keyframes (evenly spaced along the curve).
 * Used for the neck so it can taper elegantly into the head.
 */
function taperedTube(
  pts: [number, number, number][],
  radii: number[],
  segs = 26,
  radial = 18,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])))
  const frames = curve.computeFrenetFrames(segs, false)
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const c = curve.getPoint(t)
    const n = frames.normals[Math.min(i, segs - 1)]
    const b = frames.binormals[Math.min(i, segs - 1)]
    const f = t * (radii.length - 1)
    const i0 = Math.floor(f)
    const i1 = Math.min(radii.length - 1, i0 + 1)
    const r = radii[i0] + (radii[i1] - radii[i0]) * (f - i0)
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      pos.push(
        c.x + (n.x * ca + b.x * sa) * r,
        c.y + (n.y * ca + b.y * sa) * r,
        c.z + (n.z * ca + b.z * sa) * r,
      )
    }
  }
  const ring = radial + 1
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j
      idx.push(a, a + ring, a + 1, a + 1, a + ring, a + ring + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Rounded, tapering horn-like solid along +Y (lathe), e.g. beak halves. */
function latheProfile(prof: [number, number][], segs = 20): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    prof.map((p) => new THREE.Vector2(p[0], p[1])),
    segs,
  )
}

function blob(
  r: number,
  sx: number,
  sy: number,
  sz: number,
  mat: THREE.Material,
  segW = 20,
  segH = 14,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, segW, segH), mat)
  m.scale.set(sx, sy, sz)
  m.castShadow = true
  return m
}

interface Particle {
  mesh: THREE.Mesh
  vx: number
  vy: number
  spin: number
  life: number
  max: number
  grow: number
}

export interface DuckFrame {
  vx: number // world-space horizontal velocity
  grounded: boolean
  swinging: boolean
  falling: boolean // airborne, dropping fast
  fast: boolean // airborne + high speed (flight after a release)
  tilt: number // world-space rope tilt while swinging (rad), else 0
  pump: number // -1..1 pumping input while swinging, else 0
  won: boolean // celebration!
}

export class Duck {
  /** Physics anchor: root sits at the collider's bottom-center (feet). */
  readonly root = new THREE.Group()
  /** Visual facing: 1 = right, -1 = left. Rotation eases smoothly. */
  facing = 1

  private squash = new THREE.Group()
  private bodyGrp = new THREE.Group()
  private neckGrp = new THREE.Group()
  private headGrp = new THREE.Group()
  private eyes: THREE.Group[] = []
  private feet: THREE.Mesh[] = []
  private wings: THREE.Group[] = []

  private matBody = toyMat(C.body)
  private matWing = toyMat(C.wing, 0.65)
  private matBeak = toyMat(C.beak, 0.34)
  private matBeakLow = toyMat(C.beakLow, 0.4)
  private matFeet = toyMat(C.feet, 0.5)
  private matEye = new THREE.MeshStandardMaterial({ color: C.eye, roughness: 0.16, metalness: 0.1 })

  private dustGeo = new THREE.SphereGeometry(0.05, 6, 5)
  private sparkGeo = new THREE.OctahedronGeometry(0.036, 0)
  private streakGeo = new THREE.SphereGeometry(0.055, 8, 6)
  private particles: Particle[] = []

  private t = 0
  private runPhase = 0
  private lean = 0
  private sqY = 1 // squash/stretch scale-y, spring-driven
  private sqVel = 0
  private nod = 0 // head pitch spring (landing)
  private nodVel = 0
  private blinkIn = 2.2
  private blinkLeft = 0
  private sitBlend = 0
  private airBlend = 0
  private curiosity = 0
  private curiosityTarget = 0
  private curiosityIn = 3
  private streakIn = 0
  private celebT = 0 // celebratory animation timer (checkpoint / section)
  private dizzyT = 0 // cute recovery animation timer (after respawn)
  private stepHalf = 0

  constructor() {
    this.build()
    // the duck is the star — present it a touch larger than collider scale
    this.root.scale.setScalar(1.14)
    // exporters expect unit normals; computeVertexNormals output can be
    // denormalized after custom sweeping, so normalize everything once
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && mesh.geometry.getAttribute('normal')) {
        const n = mesh.geometry.getAttribute('normal') as THREE.BufferAttribute
        const v = new THREE.Vector3()
        for (let i = 0; i < n.count; i++) {
          v.fromBufferAttribute(n, i).normalize()
          n.setXYZ(i, v.x, v.y, v.z)
        }
        n.needsUpdate = true
      }
    })
  }

  private build(): void {
    this.root.add(this.squash)
    this.squash.add(this.bodyGrp)

    // ---- torso: one smooth pear-shaped lathe (chest low & plump, back
    // tapering up toward the tail) — the ornament silhouette ----
    const prof: [number, number][] = [
      [0.001, 0.0],
      [0.15, 0.012],
      [0.25, 0.075],
      [0.32, 0.185],
      [0.352, 0.33],
      [0.353, 0.47],
      [0.33, 0.6],
      [0.29, 0.72],
      [0.225, 0.82],
      [0.135, 0.885],
      [0.001, 0.92],
    ]
    const torso = new THREE.Mesh(latheProfile(prof, 30), this.matBody)
    torso.scale.set(1.14, 1.02, 0.84) // elongated fore-aft, slim depth
    torso.position.y = 0.16
    torso.castShadow = true
    this.bodyGrp.add(torso)

    // ---- perky little tail ----
    const tail = blob(0.13, 1.3, 0.55, 0.8, this.matBody)
    tail.position.set(-0.32, 0.92, 0)
    tail.rotation.z = 0.6
    this.bodyGrp.add(tail)

    // ---- tiny folded wings (rounded teardrop panels on the sides) ----
    const wingShape = new THREE.Shape()
    wingShape.moveTo(0.02, 0.02)
    wingShape.quadraticCurveTo(-0.2, -0.01, -0.3, -0.12)
    wingShape.quadraticCurveTo(-0.345, -0.165, -0.3, -0.2)
    wingShape.quadraticCurveTo(-0.16, -0.235, -0.045, -0.145)
    wingShape.quadraticCurveTo(0.025, -0.07, 0.02, 0.02)
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.018,
      bevelSegments: 2,
      curveSegments: 10,
    })
    wingGeo.translate(0, 0, -0.025)
    for (const zs of [0.335, -0.335]) {
      const g = new THREE.Group()
      g.position.set(0.03, 0.66, zs)
      const w = new THREE.Mesh(wingGeo, this.matWing)
      w.scale.set(1.3, 1.3, 1.15)
      w.castShadow = true
      w.rotation.y = zs > 0 ? -0.2 : 0.2
      g.add(w)
      this.wings.push(g)
      this.bodyGrp.add(g)
    }

    // ---- long elegant neck (tapered sweep) + head ----
    this.neckGrp.position.set(0.135, 0.94, 0)
    const neck = new THREE.Mesh(
      taperedTube(
        [
          [0, -0.09, 0],
          [0.05, 0.17, 0],
          [0.105, 0.35, 0],
          [0.16, 0.47, 0],
        ],
        [0.138, 0.12, 0.104, 0.096],
      ),
      this.matBody,
    )
    neck.castShadow = true
    this.neckGrp.add(neck)
    this.bodyGrp.add(this.neckGrp)

    this.headGrp.position.set(0.195, 0.56, 0)
    const skull = blob(0.205, 1.06, 0.95, 0.99, this.matBody, 24, 18)
    this.headGrp.add(skull)

    // beak: two smooth lathe halves — a big friendly scoop like the reference
    const beakUpGeo = latheProfile(
      [
        [0.1, 0.0],
        [0.122, 0.055],
        [0.112, 0.13],
        [0.082, 0.21],
        [0.042, 0.29],
        [0.001, 0.325],
      ],
      24,
    )
    beakUpGeo.rotateZ(-Math.PI / 2)
    beakUpGeo.scale(1, 0.78, 1.1)
    const beakUp = new THREE.Mesh(beakUpGeo, this.matBeak)
    beakUp.position.set(0.06, 0.012, 0)
    beakUp.rotation.z = -0.06
    beakUp.castShadow = true
    this.headGrp.add(beakUp)

    const beakLoGeo = latheProfile(
      [
        [0.062, 0.0],
        [0.072, 0.05],
        [0.05, 0.12],
        [0.001, 0.175],
      ],
      20,
    )
    beakLoGeo.rotateZ(-Math.PI / 2)
    beakLoGeo.scale(1, 0.55, 0.98)
    const beakLo = new THREE.Mesh(beakLoGeo, this.matBeakLow)
    beakLo.position.set(0.058, -0.07, 0)
    beakLo.rotation.z = -0.16
    this.headGrp.add(beakLo)

    // glossy bead eyes + catchlight (they read at phone size)
    for (const zs of [0.148, -0.148]) {
      const g = new THREE.Group()
      g.position.set(0.09, 0.06, zs)
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), this.matEye)
      bead.scale.set(1, 1.32, 0.62)
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      )
      glow.position.set(0.011, 0.016, zs > 0 ? 0.016 : -0.016)
      g.add(bead, glow)
      this.headGrp.add(g)
      this.eyes.push(g)
    }
    this.neckGrp.add(this.headGrp)

    // ---- small orange webbed feet (on `squash` so the body bounce lifts
    // while the feet stay near the ground) ----
    const footShape = new THREE.Shape()
    footShape.moveTo(0, 0.062)
    footShape.quadraticCurveTo(0.14, 0.085, 0.235, 0.062)
    footShape.quadraticCurveTo(0.16, 0.028, 0.185, 0.008)
    footShape.quadraticCurveTo(0.245, -0.002, 0.245, -0.014)
    footShape.quadraticCurveTo(0.16, -0.03, 0.175, -0.052)
    footShape.quadraticCurveTo(0.2, -0.078, 0.185, -0.088)
    footShape.quadraticCurveTo(0.08, -0.1, 0, -0.07)
    footShape.quadraticCurveTo(-0.05, -0.005, 0, 0.062)
    const footGeo = new THREE.ExtrudeGeometry(footShape, {
      depth: 0.032,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
      curveSegments: 8,
    })
    footGeo.rotateX(-Math.PI / 2)
    for (const zs of [0.15, -0.15]) {
      const f = new THREE.Mesh(footGeo, this.matFeet)
      f.castShadow = true
      f.position.set(0.0, 0.052, zs)
      this.squash.add(f)
      this.feet.push(f)
    }
  }

  // ---------------- expressive events (called by the controller) ----------------

  onJump(): void {
    // anticipation: a quick compress-and-rebound — the duck dips for a few
    // frames, then the spring's rebound becomes the launch stretch
    this.sqVel = -3.6
    this.nodVel -= 2.2
  }

  /** Brief celebratory bounce (checkpoint reached / section done). */
  celebrate(): void {
    this.celebT = 0.9
    this.sqVel = 2.4
  }

  /** Cute recovery wobble right after respawning from a fall. */
  dizzy(): void {
    this.dizzyT = 1.15
  }

  /** Footstep callback hook fed from the controller's run-cycle phase. */
  consumeStep(): boolean {
    const half = Math.floor(this.runPhase / Math.PI)
    if (half !== this.stepHalf) {
      this.stepHalf = half
      return true
    }
    return false
  }

  onLand(fallSpeed: number): void {
    this.sqVel = -Math.min(9, 3.0 + fallSpeed * 0.4) // squash impulse
    this.nodVel += 2.6
    this.dust(fallSpeed > 6 ? 4 : 2)
  }

  onGrab(): void {
    this.sqVel = 2.0
    this.sparks(6)
  }

  private dust(n: number): void {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        this.dustGeo,
        new THREE.MeshBasicMaterial({ color: 0xfff8ea, transparent: true, opacity: 0.75 }),
      )
      m.position.set((Math.random() - 0.5) * 0.2, 0.06, (Math.random() - 0.5) * 0.24)
      this.particles.push({
        mesh: m,
        vx: (Math.random() - 0.5) * 1.6,
        vy: 0.6 + Math.random() * 0.8,
        spin: 0,
        life: 0.38,
        max: 0.38,
        grow: 1.2,
      })
      this.root.add(m)
    }
  }

  private sparks(n: number): void {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        this.sparkGeo,
        new THREE.MeshBasicMaterial({
          color: Math.random() > 0.5 ? 0xffc24d : 0xfff3c2,
          transparent: true,
          opacity: 0.95,
        }),
      )
      const a = (i / n) * Math.PI * 2
      m.position.set(Math.cos(a) * 0.22, 0.55 + Math.sin(a) * 0.3, (Math.random() - 0.5) * 0.2)
      this.particles.push({
        mesh: m,
        vx: Math.cos(a) * 1.7,
        vy: 1.6 + Math.random() * 1.2,
        spin: (Math.random() - 0.5) * 12,
        life: 0.42,
        max: 0.42,
        grow: 0.2,
      })
      this.root.add(m)
    }
  }

  private streak(): void {
    const m = new THREE.Mesh(
      this.streakGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }),
    )
    m.scale.set(3.1, 0.32, 0.32)
    m.position.set(-this.facing * (0.3 + Math.random() * 0.3), 0.35 + Math.random() * 0.7, (Math.random() - 0.5) * 0.4)
    this.particles.push({
      mesh: m,
      vx: -this.facing * 2.4,
      vy: 0.2,
      spin: 0,
      life: 0.24,
      max: 0.24,
      grow: 2.4,
    })
    this.root.add(m)
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
    const localVx = s.vx * this.facing
    const runAmt = Math.min(1, speedAbs / 4.2)
    this.celebT = Math.max(0, this.celebT - dt)
    this.dizzyT = Math.max(0, this.dizzyT - dt)
    const celeb = this.celebT > 0 ? Math.sin((1 - this.celebT / 0.9) * Math.PI) : 0
    const dizzy = this.dizzyT > 0 ? Math.sin(this.dizzyT / 1.15 * Math.PI) : 0

    // pose blends
    this.sitBlend += ((s.swinging ? 1 : 0) - this.sitBlend) * Math.min(1, dt * 9)
    this.airBlend += ((s.grounded || s.swinging ? 0 : 1) - this.airBlend) * Math.min(1, dt * 9)

    // run cycle phase
    if (s.grounded && !s.swinging && speedAbs > 0.25) {
      this.runPhase += dt * (5 + speedAbs * 2.4)
    }
    const w = this.runPhase

    // body bounce + forward lean (+ celebration hop wiggle / dizzy wobble)
    const bounce = s.grounded && !s.swinging ? Math.abs(Math.sin(w)) * 0.05 * runAmt : 0
    const leanTarget = s.swinging
      ? -0.1
      : s.grounded
        ? Math.max(-0.18, Math.min(0.18, localVx * 0.045))
        : Math.max(-0.14, Math.min(0.14, localVx * 0.022)) + (s.falling ? 0.1 : -0.06)
    this.lean += (leanTarget - this.lean) * Math.min(1, dt * 10)
    this.bodyGrp.rotation.z =
      -this.lean + 0.12 * this.sitBlend + Math.sin(this.t * 14) * 0.09 * celeb + Math.sin(this.t * 9) * 0.11 * dizzy
    this.bodyGrp.position.y = bounce + 0.02 * this.sitBlend + celeb * 0.05
    this.bodyGrp.rotation.y = Math.sin(this.t * 4.5) * 0.2 * dizzy

    // gentle breathing while idle
    const idle = s.grounded && speedAbs < 0.25 && !s.swinging
    const breathe = idle ? Math.sin(this.t * 2.4) * 0.014 : 0
    this.bodyGrp.scale.set(1 + breathe * 0.6, 1 + breathe, 1 + breathe * 0.6)

    // neck: counter-sways while running, rocks while pumping, curious tilts
    // while idle, stretches forward in flight
    let neckRot = -this.lean * 0.55
    if (s.swinging) neckRot += s.pump * 0.16 + Math.sin(this.t * 1.7) * 0.03
    if (idle) {
      this.curiosityIn -= dt
      if (this.curiosityIn <= 0) {
        this.curiosityTarget = (Math.random() - 0.5) * 0.34
        this.curiosityIn = 2.4 + Math.random() * 3
      }
      this.curiosity += (this.curiosityTarget - this.curiosity) * Math.min(1, dt * 2.2)
      neckRot += this.curiosity + Math.sin(this.t * 2.4) * 0.015
    } else {
      this.curiosity *= Math.max(0, 1 - dt * 5)
    }
    if (this.airBlend > 0.5) neckRot += (s.falling ? -0.1 : 0.16) * this.airBlend
    this.neckGrp.rotation.z += (neckRot - this.neckGrp.rotation.z) * Math.min(1, dt * 8)

    // head: landing nod spring (+ celebration nod / dizzy head-shake)
    this.nodVel += (-160 * this.nod - 12 * this.nodVel) * dt
    this.nod += this.nodVel * dt
    this.headGrp.rotation.z =
      Math.max(-0.5, Math.min(0.5, this.nod)) +
      (s.won ? Math.sin(this.t * 6) * 0.06 : 0) +
      celeb * Math.sin(this.t * 11) * 0.14 +
      dizzy * Math.sin(this.t * 12) * 0.2

    // rope tilt while swinging (applied in facing space)
    this.squash.rotation.z += ((s.swinging ? -s.tilt * this.facing * 0.55 : 0) - this.squash.rotation.z) * Math.min(1, dt * 12)

    // feet: walk cycle / air dangle / sit dangle (legs lag the swing — juicy)
    const stepAmp = 0.16 * runAmt
    const liftAmp = 0.08 * runAmt
    const standX = 0.0
    const airX = -0.13
    const sitX = 0.26
    const lag = s.swinging ? -s.tilt * this.facing * 0.22 + s.pump * 0.07 : 0
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i]
      const phase = w + (i === 0 ? 0 : Math.PI)
      const walkX = Math.sin(phase) * stepAmp
      const lift = Math.max(0, Math.sin(phase + Math.PI / 2)) * liftAmp
      const stand = new THREE.Vector3(standX + walkX, 0.052 + lift, i === 0 ? 0.15 : -0.15)
      const air = new THREE.Vector3(airX, 0.04 + Math.sin(this.t * 3 + i * 1.4) * 0.02, i === 0 ? 0.15 : -0.15)
      const sit = new THREE.Vector3(sitX + lag + (i === 0 ? 0.02 : -0.02), 0.035 + lag * 0.12, i === 0 ? 0.16 : -0.16)
      const target = stand.lerp(air, this.airBlend).lerp(sit, this.sitBlend)
      f.position.lerp(target, Math.min(1, dt * 22))
      f.rotation.z = (f.position.x - standX) * -1.2
    }

    // wings: tucked at rest · flutter on run · spread in air · hold the
    // ropes when sitting · big proud flaps when celebrating
    let wingTarget: number
    let wingSpeed = 0
    if (s.won || celeb > 0.2) {
      wingTarget = -1.5
      wingSpeed = 15
    } else if (s.swinging) {
      wingTarget = -1.9 + s.pump * 0.12
    } else if (!s.grounded) {
      wingTarget = s.fast ? -0.9 : -1.25
      wingSpeed = s.fast ? 13 : 7
    } else {
      wingTarget = 0.12 + Math.abs(Math.sin(w)) * 0.1 * runAmt
    }
    for (let i = 0; i < 2; i++) {
      const wing = this.wings[i]
      const flap = wingSpeed > 0 ? Math.sin(this.t * wingSpeed + (i === 0 ? 0 : 0.35)) * 0.4 : 0
      wing.rotation.z += (wingTarget + flap - wing.rotation.z) * Math.min(1, dt * 12)
    }

    // blink (wide eyes when falling, happy squint on victory)
    this.blinkIn -= dt
    if (this.blinkIn <= 0) {
      this.blinkLeft = 0.12
      this.blinkIn = 2 + Math.random() * 2.6
    }
    if (this.blinkLeft > 0) this.blinkLeft -= dt
    const eyeY = s.won || celeb > 0.2 ? 0.42 : this.blinkLeft > 0 ? 0.12 : s.falling && !s.swinging ? 1.3 : 1
    const eyeX = dizzy > 0 ? 1 + Math.sin(this.t * 16) * 0.3 : 1
    for (const e of this.eyes) {
      e.scale.y += (eyeY - e.scale.y) * Math.min(1, dt * 30)
      e.scale.x += (eyeX - e.scale.x) * Math.min(1, dt * 20)
    }

    // wind streaks while flying fast
    this.streakIn -= dt
    if (s.fast && this.streakIn <= 0) {
      this.streak()
      this.streakIn = 0.055
    }

    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      if (p.life <= 0) {
        this.root.remove(p.mesh)
        ;(p.mesh.material as THREE.Material).dispose()
        this.particles.splice(i, 1)
        continue
      }
      p.vy -= (p.grow < 1 ? 1.2 : 5) * dt
      p.mesh.position.x += p.vx * dt
      p.mesh.position.y += p.vy * dt
      if (p.spin !== 0) {
        p.mesh.rotation.x += p.spin * dt
        p.mesh.rotation.y += p.spin * 0.7 * dt
      }
      const k2 = p.life / p.max
      const mat = p.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = k2 * (p.grow < 1 ? 0.95 : 0.75)
      p.mesh.scale.multiplyScalar(1 + p.grow * dt * (1 - k2))
    }
  }
}
