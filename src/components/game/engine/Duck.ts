/**
 * Project Duck — the duck character (V0.5 "collectible figure" rebuild).
 *
 * Visual target: the hanging-duck ornament — a smooth, manufactured-toy
 * white duck with a LONG elegant neck that flows out of the chest line, a
 * softly rounded head, a compact gently-elongated body with a perky lifted
 * tail, properly sculpted bill (not a cone), small folded wings, glossy
 * dark bead eyes with catchlights and stubby orange legs with webbed feet.
 *
 * V0.5 quality goals, compared to V0.2's model:
 *  - ONE sculpted torso: the lathe is deformed after generation (chest fill,
 *    rear lift) so the tail is part of the body silhouette, not a lump
 *  - the neck tube flares as it enters the skull — no snowman junction
 *  - a real bill: two flattened, droop-curved mandibles with vertex-tone
 *    gradients instead of faceted lathe cones
 *  - real legs with hip pivots: the run cycle, jump tuck, reach and the
 *    reference's forward-footed sit pose are all leg-driven now
 *  - warm-white vertex gradients for subtle tonal variation (no flat grey)
 *
 * Everything visual lives here; the collider is owned by Physics/Game and
 * never sees any of this. All animation is procedural and state-driven —
 * animation never fakes the swing's physics, it only reacts to it.
 */

import * as THREE from 'three'

const C = {
  bodyHi: 0xfdfaf2, // warm toy white — crown / upper surfaces
  bodyLo: 0xede2cb, // deeper cream — belly / underside shading
  wing: 0xf7f1e2, // folded wing tone — close to body, reads as a soft crease
  beakHi: 0xffb054, // bright orange-yellow, base
  beakLo: 0xf0871c, // deeper orange, tip
  feet: 0xf59b25, // warm orange legs + webbed feet
  eye: 0x1d1712, // glossy near-black
}

const colHi = new THREE.Color(C.bodyHi)
const colLo = new THREE.Color(C.bodyLo)

/** Smoothstep from a to b (works with b < a — the clamp flips it). */
function smooth(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

function clampF(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function bodyMat(): THREE.MeshPhysicalMaterial {
  // V2: the reference photo reads as a soft, warm, almost-matte plush/resin
  // finish (diffuse highlights, no hard specular glint on the body) rather
  // than a glossy ceramic glaze — roughness up, clearcoat down from V0.7.
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.68,
    metalness: 0,
    clearcoat: 0.14,
    clearcoatRoughness: 0.7,
  })
}

function toyMat(color: number, rough = 0.55): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: rough,
    metalness: 0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.55,
  })
}

/**
 * Smooth tube swept along a Catmull-Rom path with a radius that varies
 * linearly across the `radii` keyframes (evenly spaced along the curve).
 * Used for the neck so it can taper elegantly and flare into the head.
 */
function taperedTube(
  pts: [number, number, number][],
  radii: number[],
  segs = 30,
  radial = 22,
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

/** Lathe from a (radius, height) profile. */
function latheProfile(prof: [number, number][], segs = 36): THREE.LatheGeometry {
  return new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p[0], p[1])), segs)
}

/**
 * Sculpt the raw pear lathe into the ornament silhouette:
 *  - elongate fore-aft, slim side-to-side
 *  - fill the low chest
 *  - rotate the rear up around a mid-body pivot so the tail line is part
 *    of the body itself (perky, tucked, smooth — no separate lump)
 */
function sculptTorso(geo: THREE.BufferGeometry): void {
  // V2 reference pass: the photo reference is a compact, rounded "egg" body
  // — much less fore-aft stretch than v4's 1.38x, and a tucked, blunt rear
  // instead of a perky lifted tail-line (the rear lift is now subtle, just
  // enough to avoid a flat dead-end).
  const p = geo.getAttribute('position') as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    let x = v.x * 1.16
    const y = v.y
    const z = v.z * 0.96
    x += smooth(0.05, 0.42, x) * smooth(0.5, 0.08, y) * 0.06 // chest fill
    const rear = smooth(0.02, -0.55, x)
    const a = -0.12 * rear // gentle tuck, not a perky lift
    const py = y - 0.36
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    p.setXYZ(i, x * ca - py * sa, x * sa + py * ca + 0.36, z)
  }
  geo.computeVertexNormals()
}

/** Per-vertex tint along Y (lo at yLo → hi at yHi). Adds soft tonal depth. */
function paintY(geo: THREE.BufferGeometry, yLo: number, yHi: number, lo = colLo, hi = colHi): void {
  const pos = geo.getAttribute('position')
  const col = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - yLo) / (yHi - yLo)))
    c.copy(lo).lerp(hi, t)
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
}

/** Per-vertex tint along X (used for the bill: warm base → deep tip). */
function paintX(geo: THREE.BufferGeometry, xLo: number, xHi: number, lo: THREE.Color, hi: THREE.Color): void {
  const pos = geo.getAttribute('position')
  const col = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getX(i) - xLo) / (xHi - xLo)))
    c.copy(lo).lerp(hi, t)
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
}

function blob(
  r: number,
  sx: number,
  sy: number,
  sz: number,
  mat: THREE.Material,
  segW = 24,
  segH = 18,
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
  vy: number // world-space vertical velocity (drives air pitch, visual only)
  grounded: boolean
  swinging: boolean
  falling: boolean // airborne, dropping fast
  fast: boolean // airborne + high speed (flight after a release)
  tilt: number // world-space rope tilt while swinging (rad), else 0
  pump: number // -1..1 pumping input while swinging, else 0
  won: boolean // celebration!
  groundY: number // top of the highest platform below the duck (landing read)
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
  private tailGrp = new THREE.Group()
  private hips: THREE.Group[] = []
  private feet: THREE.Group[] = []
  private eyes: THREE.Group[] = []
  private wings: THREE.Group[] = []

  private matBody = bodyMat()
  private matWing = toyMat(C.wing, 0.6)
  private matBeak = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.4,
  })
  private matFeet = toyMat(C.feet, 0.5)
  private matEye = new THREE.MeshStandardMaterial({ color: C.eye, roughness: 0.16, metalness: 0.1 })

  private dustGeo = new THREE.SphereGeometry(0.05, 6, 5)
  private sparkGeo = new THREE.OctahedronGeometry(0.036, 0)
  private streakGeo = new THREE.SphereGeometry(0.055, 8, 6)
  private particles: Particle[] = []

  /** Soft contact shadow — added to the SCENE by Game (world-space). */
  readonly shadowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.66),
    new THREE.MeshBasicMaterial({
      map: Duck.shadowTexture(),
      transparent: true,
      depthWrite: false,
    }),
  )

  private static shadowTexture(): THREE.Texture {
    // guarded so non-DOM environments (GLB export under bun) can still
    // construct the duck — they just get a flat 1px stand-in
    if (typeof document === 'undefined') {
      const flat = new THREE.DataTexture(new Uint8Array([140, 120, 90, 255]), 1, 1)
      flat.needsUpdate = true
      return flat
    }
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62)
    g.addColorStop(0, 'rgba(38, 30, 18, 0.46)')
    g.addColorStop(0.65, 'rgba(38, 30, 18, 0.24)')
    g.addColorStop(1, 'rgba(38, 30, 18, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(c)
  }

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
  private glanceIn = 5 // idle "look at the player" timer
  private glanceLeft = 0
  private glanceTarget = 0
  private flingT = 0 // release "fling" pose timer
  private streakIn = 0
  private celebT = 0 // celebratory animation timer (checkpoint / section)
  private dizzyT = 0 // cute recovery animation timer (after respawn)
  private stepHalf = 0
  private lastVx = 0
  private accelSm = 0 // smoothed |vx| change — run acceleration anticipation
  private flickT = 4 // idle tail-flick timer
  private flickA = 0 // active tail-flick envelope

  constructor() {
    this.build()
    this.shadowMesh.rotation.x = -Math.PI / 2
    this.shadowMesh.renderOrder = 2
    this.shadowMesh.visible = false
    // the duck is the star — present it a touch larger than collider scale
    this.root.scale.setScalar(1.26)
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

    // ---- torso: one sculpted lathe — deep plump chest, back flowing down
    // and up into a perky lifted tail (part of the silhouette, not a lump) ----
    const prof: [number, number][] = [
      [0.001, 0.0],
      [0.1, 0.004],
      [0.2, 0.028],
      [0.29, 0.09],
      [0.335, 0.19],
      [0.345, 0.3],
      [0.335, 0.4],
      [0.31, 0.5],
      [0.27, 0.585],
      [0.21, 0.655],
      [0.13, 0.705],
      [0.001, 0.74],
    ]
    const torsoGeo = latheProfile(prof, 36)
    sculptTorso(torsoGeo)
    torsoGeo.translate(0, 0.22, 0)
    paintY(torsoGeo, 0.2, 0.98)
    const torso = new THREE.Mesh(torsoGeo, this.matBody)
    torso.castShadow = true
    this.bodyGrp.add(torso)

    // ---- V2: a small blunt tail bump, mostly tucked into the rounded rear
    // — the reference photo shows almost no visible tail, just a soft tuck
    // where the body closes off, not a raised perky point ----
    const tailGeo = latheProfile(
      [
        [0.001, 0.0],
        [0.055, 0.022],
        [0.078, 0.06],
        [0.07, 0.105],
        [0.044, 0.148],
        [0.018, 0.175],
        [0.001, 0.185],
      ],
      22,
    )
    paintY(tailGeo, 0.0, 0.185)
    this.tailGrp.position.set(-0.3, 0.52, 0)
    this.tailGrp.rotation.z = 0.2 // mostly tucked, just a soft bump back
    const tail = new THREE.Mesh(tailGeo, this.matBody)
    tail.scale.setScalar(0.95)
    tail.castShadow = true
    this.tailGrp.add(tail)
    this.bodyGrp.add(this.tailGrp)

    // ---- folded wings (V2: soft puffy plumage, not a hard applique) ----
    // The reference photo shows almost no distinct wing edge — just a soft
    // crease in the plumage barely readable against the body. The shape is
    // smaller, rounder (fewer sharp direction changes) and nearly flush —
    // shallow extrude depth + a lighter, closer-to-body tone — so it reads
    // as a gentle fold rather than a stuck-on leaf shape.
    const wingShape = new THREE.Shape()
    wingShape.moveTo(0.14, 0.02)
    wingShape.quadraticCurveTo(0.09, 0.09, -0.02, 0.1)
    wingShape.quadraticCurveTo(-0.14, 0.1, -0.22, 0.04)
    wingShape.quadraticCurveTo(-0.27, -0.01, -0.24, -0.04)
    wingShape.quadraticCurveTo(-0.15, -0.065, -0.05, -0.06)
    wingShape.quadraticCurveTo(0.04, -0.05, 0.14, 0.02)
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.026,
      bevelEnabled: true,
      bevelThickness: 0.016,
      bevelSize: 0.02,
      bevelSegments: 4,
      curveSegments: 10,
    })
    wingGeo.translate(0, 0, -0.013)
    // a second, smaller covert layer — kept subtle, almost the same tone
    const covertGeo = wingGeo.clone()
    for (const zs of [0.3, -0.3]) {
      const g = new THREE.Group()
      g.position.set(0.08, 0.63, zs)
      const w = new THREE.Mesh(wingGeo, this.matWing)
      w.scale.set(0.85, 0.85, 0.85)
      w.castShadow = true
      // wrap around the flank + roll the top edge toward the back line
      w.rotation.y = zs > 0 ? -0.3 : 0.3
      w.rotation.x = zs > 0 ? 0.08 : -0.08
      g.add(w)
      const w2 = new THREE.Mesh(covertGeo, this.matWing)
      w2.scale.set(0.5, 0.5, 0.65)
      w2.position.set(0.04, -0.012, zs > 0 ? 0.015 : -0.015)
      w2.rotation.y = zs > 0 ? -0.32 : 0.32
      g.add(w2)
      g.rotation.z = -0.1 // only a slight downward slope — mostly flush
      this.wings.push(g)
      this.bodyGrp.add(g)
    }

    // ---- V2: short, thick neck straight from the reference photo ----
    // The photo shows the head sitting close and low on the body — a short,
    // chunky neck, not the long elegant swan-sweep of earlier versions. The
    // tube still starts deep inside the chest (flared base, no collar
    // crease) but now covers roughly 2/3 the vertical span and stays
    // noticeably thicker along its whole length (toy-plush, not slender).
    this.neckGrp.position.set(0.21, 0.66, 0)
    this.neckGrp.rotation.z = -0.04
    const neck = new THREE.Mesh(
      taperedTube(
        [
          [0.02, -0.22, 0],
          [0.0, 0.02, 0],
          [-0.01, 0.16, 0],
          [0.04, 0.28, 0],
          [0.1, 0.36, 0],
        ],
        [0.21, 0.195, 0.175, 0.165, 0.165],
      ),
      this.matBody,
    )
    neck.castShadow = true
    paintY(neck.geometry, -0.1, 0.46)
    this.neckGrp.add(neck)
    this.bodyGrp.add(this.neckGrp)

    // ---- head: rounded skull, sitting close on the short neck ----
    // V2: the reference photo's head reads noticeably large against the
    // body (toy proportions) — bumped up from 0.24 to 0.26.
    this.headGrp.position.set(0.11, 0.37, 0)
    const skullGeo = new THREE.SphereGeometry(0.26, 28, 22)
    skullGeo.scale(1.03, 0.96, 0.98)
    paintY(skullGeo, -0.18, 0.24)
    const skull = new THREE.Mesh(skullGeo, this.matBody)
    skull.castShadow = true
    this.headGrp.add(skull)

    // ---- bill: two smooth flattened mandibles with droop-curved tips ----
    const beakUpGeo = latheProfile(
      [
        [0.001, 0.0],
        [0.033, 0.006],
        [0.062, 0.02],
        [0.084, 0.044],
        [0.094, 0.076],
        [0.094, 0.108],
        [0.086, 0.14],
        [0.07, 0.166],
        [0.048, 0.188],
        [0.026, 0.202],
        [0.009, 0.209],
        [0.001, 0.211],
      ],
      26,
    )
    beakUpGeo.rotateZ(-Math.PI / 2)
    // V2: bigger, blunter bill to match the reference's big friendly scoop
    // and the enlarged head.
    beakUpGeo.scale(1.1, 0.68, 1.38)
    // gentle droop toward the tip
    {
      const p = beakUpGeo.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i)
        if (x > 0.08) p.setY(i, p.getY(i) - (x - 0.08) * (x - 0.08) * 1.5)
      }
      beakUpGeo.computeVertexNormals()
    }
    paintX(beakUpGeo, 0.0, 0.21, new THREE.Color(C.beakHi), new THREE.Color(C.beakLo))
    const beakUp = new THREE.Mesh(beakUpGeo, this.matBeak)
    beakUp.position.set(0.175, -0.008, 0)
    beakUp.rotation.z = -0.05
    beakUp.castShadow = true
    this.headGrp.add(beakUp)

    const beakLoGeo = latheProfile(
      [
        [0.001, 0.0],
        [0.04, 0.01],
        [0.066, 0.036],
        [0.074, 0.072],
        [0.06, 0.118],
        [0.034, 0.152],
        [0.001, 0.166],
      ],
      22,
    )
    beakLoGeo.rotateZ(-Math.PI / 2)
    beakLoGeo.scale(1.1, 0.48, 1.14)
    paintX(beakLoGeo, 0.0, 0.17, new THREE.Color(C.beakHi), new THREE.Color(C.beakLo))
    const beakLo = new THREE.Mesh(beakLoGeo, this.matBeak)
    beakLo.position.set(0.155, -0.08, 0)
    beakLo.rotation.z = 0.1
    this.headGrp.add(beakLo)

    // glossy bead eyes + catchlight (they read at phone size)
    for (const zs of [0.2, -0.2]) {
      const g = new THREE.Group()
      g.position.set(0.14, 0.08, zs)
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.047, 14, 12), this.matEye)
      bead.scale.set(1, 1.28, 0.62)
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      )
      glow.position.set(0.012, 0.017, zs > 0 ? 0.014 : -0.014)
      g.add(bead, glow)
      this.headGrp.add(g)
      this.eyes.push(g)
    }
    this.neckGrp.add(this.headGrp)

    // ---- stubby orange legs with webbed feet (on `squash` so landings
    // compress the whole character; hips are the animation pivots) ----
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
    for (const zs of [0.145, -0.145]) {
      const hip = new THREE.Group()
      hip.position.set(0.03, 0.28, zs)
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.12, 6, 12), this.matFeet)
      thigh.position.set(0, -0.08, 0)
      thigh.castShadow = true
      hip.add(thigh)
      const ankle = new THREE.Group()
      ankle.position.set(0.015, -0.22, 0)
      const foot = new THREE.Mesh(footGeo, this.matFeet)
      foot.position.y = 0.012
      foot.castShadow = true
      ankle.add(foot)
      hip.add(ankle)
      this.squash.add(hip)
      this.hips.push(hip)
      this.feet.push(ankle)
    }
  }

  // ---------------- expressive events (called by the controller) ----------------

  onJump(puff = false): void {
    // anticipation: a quick compress-and-rebound — the duck dips for a few
    // frames, then the spring's rebound becomes the launch stretch
    this.sqVel = -3.6
    this.nodVel -= 2.2
    // a puff of turf only for real ground takeoffs (not swing releases)
    if (puff) this.dust(2)
  }

  /** The fling pose right after letting go of a swing. */
  onRelease(): void {
    this.flingT = 0.5
    this.sqVel = 2.6
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
    // hard cap keeps bursts from ever stacking up on weak devices
    if (this.particles.length > 80) return
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
    if (this.particles.length > 80) return
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
    if (this.particles.length > 80) return
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

    // contact shadow: hugs the ground below, fades as the duck climbs —
    // doubles as a landing-spot readability cue over gaps
    const h = Math.max(0, this.root.position.y - s.groundY)
    const shadowVis = Math.max(0, 1 - h / 3.4)
    const shadowMat = this.shadowMesh.material as THREE.MeshBasicMaterial
    shadowMat.opacity = 0.9 * shadowVis
    const shadowScale = 1 + Math.min(1.4, h * 0.16) * 0.3
    this.shadowMesh.scale.set(shadowScale, shadowScale, 1)
    this.shadowMesh.position.set(this.root.position.x, s.groundY + 0.035, 0)
    this.shadowMesh.visible = shadowVis > 0.04 && s.groundY > -7

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
    // smoothed acceleration magnitude (grounded launches get a lean-in)
    const accel = Math.abs(s.vx - this.lastVx) / Math.max(dt, 1e-4)
    this.lastVx = s.vx
    this.accelSm += (Math.min(30, accel) - this.accelSm) * Math.min(1, dt * 6)
    this.celebT = Math.max(0, this.celebT - dt)
    this.dizzyT = Math.max(0, this.dizzyT - dt)
    this.flingT = Math.max(0, this.flingT - dt)
    const celeb = this.celebT > 0 ? Math.sin((1 - this.celebT / 0.9) * Math.PI) : 0
    const dizzy = this.dizzyT > 0 ? Math.sin(this.dizzyT / 1.15 * Math.PI) : 0
    const fling = this.flingT > 0 ? Math.sin((1 - this.flingT / 0.5) * Math.PI) : 0

    // pose blends
    this.sitBlend += ((s.swinging ? 1 : 0) - this.sitBlend) * Math.min(1, dt * 9)
    this.airBlend += ((s.grounded || s.swinging ? 0 : 1) - this.airBlend) * Math.min(1, dt * 9)

    // run cycle phase
    if (s.grounded && !s.swinging && speedAbs > 0.25) {
      this.runPhase += dt * (5 + speedAbs * 2.4)
    }
    const w = this.runPhase

    // body bounce + forward lean (+ celebration hop wiggle / dizzy wobble)
    // V0.7: accelerating from a standstill leans the duck INTO the run —
    // the readable "anticipation" of a take-off, without touching physics
    const accelLean = s.grounded && !s.swinging ? Math.min(0.09, this.accelSm * 0.006) : 0
    const bounce = s.grounded && !s.swinging ? Math.abs(Math.sin(w)) * 0.05 * runAmt : 0
    const leanTarget = s.swinging
      ? 0
      : s.grounded
        ? Math.max(-0.18, Math.min(0.18, localVx * 0.045)) + accelLean
        : Math.max(-0.14, Math.min(0.14, localVx * 0.022)) +
          clampF(-s.vy * 0.012, -0.06, 0.12) +
          (s.falling ? 0.04 : 0)
    this.lean += (leanTarget - this.lean) * Math.min(1, dt * 10)
    this.bodyGrp.rotation.z =
      -this.lean + 0.1 * this.sitBlend + Math.sin(this.t * 14) * 0.09 * celeb + Math.sin(this.t * 9) * 0.11 * dizzy
    this.bodyGrp.position.y = bounce + celeb * 0.05
    this.bodyGrp.rotation.y = Math.sin(this.t * 4.5) * 0.2 * dizzy

    // gentle breathing while idle
    const idle = s.grounded && speedAbs < 0.25 && !s.swinging
    const breathe = idle ? Math.sin(this.t * 2.4) * 0.014 : 0
    this.bodyGrp.scale.set(1 + breathe * 0.6, 1 + breathe, 1 + breathe * 0.6)

    // neck: counter-sways while running, hangs along the rope while
    // swinging (partial counter so the head leads the arc gracefully),
    // curious tilts while idle, stretches forward in flight
    let neckRot = -this.lean * 0.5
    if (s.swinging) {
      neckRot += -s.tilt * this.facing * 0.42 + s.pump * 0.14 + Math.sin(this.t * 1.8) * 0.03
    }
    // sitting: lift the head gracefully (neck rises from the perch)
    neckRot += 0.09 * this.sitBlend
    if (this.airBlend > 0.5) neckRot += ((s.falling ? -0.06 : 0.16) + fling * 0.18) * this.airBlend
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
    this.neckGrp.rotation.z += (neckRot - this.neckGrp.rotation.z) * Math.min(1, dt * 8)

    // head: landing nod spring (+ celebration nod / dizzy head-shake),
    // occasional idle glance toward the player
    this.nodVel += (-160 * this.nod - 12 * this.nodVel) * dt
    this.nod += this.nodVel * dt
    this.headGrp.rotation.z =
      Math.max(-0.5, Math.min(0.5, this.nod)) +
      (s.won ? Math.sin(this.t * 6) * 0.06 : 0) +
      celeb * Math.sin(this.t * 11) * 0.14 +
      dizzy * Math.sin(this.t * 12) * 0.2
    this.glanceIn -= dt
    if (this.glanceIn <= 0 && idle) {
      this.glanceTarget = (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.25)
      this.glanceLeft = 0.9 + Math.random() * 0.4
      this.glanceIn = 4 + Math.random() * 4
    }
    if (this.glanceLeft > 0) this.glanceLeft -= dt
    const glance = idle && this.glanceLeft > 0 ? this.glanceTarget : 0
    this.headGrp.rotation.y += (glance - this.headGrp.rotation.y) * Math.min(1, dt * 5)

    // tail: happy wag on celebration/dizzy, a lazy sway when idle, plus an
    // occasional quick flick — small burst of life while standing around
    this.flickT -= dt
    if (this.flickT <= 0) {
      this.flickA = 1
      this.flickT = 4.5 + Math.random() * 4.5
    }
    this.flickA = Math.max(0, this.flickA - dt * 2.2)
    const wagAmp = celeb * 0.5 + dizzy * 0.3
    this.tailGrp.rotation.y =
      Math.sin(this.t * 11) * wagAmp + Math.sin(this.t * 1.3) * 0.06 + Math.sin(this.t * 17) * 0.3 * this.flickA
    this.tailGrp.rotation.z = 0.45 + celeb * 0.2

    // rope alignment while swinging: the body hangs along the rope (world
    // rotation = +theta; facing flips the local sign), eased softly
    const tiltTarget = s.swinging ? s.tilt * this.facing * 0.78 : 0
    this.squash.rotation.z += (tiltTarget - this.squash.rotation.z) * Math.min(1, dt * 12)
    // V0.7 sit: perch ON the seat — feet/legs rest on the plank, body stays
    // upright along the rope, head lifted. The old deep sink (-0.26) dropped
    // the belly onto the plank and the sculpt's rear-lift read as "butt up,
    // face down"; a shallow perch keeps the ornament's upright elegance.
    this.squash.position.y += (-0.13 * this.sitBlend - this.squash.position.y) * Math.min(1, dt * 10)
    this.squash.position.x += (-0.02 * this.sitBlend - this.squash.position.x) * Math.min(1, dt * 10)

    // legs: walk cycle / airborne tuck & reach / forward sit dangle
    const stepAmp = 0.55 * runAmt
    const lag = s.swinging ? -s.tilt * this.facing * 0.3 + s.pump * 0.06 : 0
    for (let i = 0; i < 2; i++) {
      const hip = this.hips[i]
      const ankle = this.feet[i]
      const phase = w + (i === 0 ? 0 : Math.PI)
      const standHip = Math.sin(phase) * stepAmp
      const standFoot = -standHip * 0.85
      const airHip = -0.38 + (s.falling ? 0.28 : 0) - fling * 0.3
      const airFoot = s.falling ? 0.22 : 0.05
      const sitHip = 0.82 + lag + Math.sin(this.t * 2.2 + i * 1.7) * 0.07
      const sitFoot = -0.5 + Math.sin(this.t * 2.2 + i * 1.7 + 0.6) * 0.08
      const targetHip = standHip + (airHip - standHip) * this.airBlend
      const targetFoot = standFoot + (airFoot - standFoot) * this.airBlend
      const blendedHip = targetHip + (sitHip - targetHip) * this.sitBlend
      const blendedFoot = targetFoot + (sitFoot - targetFoot) * this.sitBlend
      hip.rotation.z += (blendedHip - hip.rotation.z) * Math.min(1, dt * 14)
      ankle.rotation.z += (blendedFoot - ankle.rotation.z) * Math.min(1, dt * 14)
    }

    // wings: tucked at rest · flutter on run · spread in air · hold the
    // ropes when sitting · flare on release · big proud flaps when celebrating
    let wingTarget: number
    let wingSpeed = 0
    if (s.won || celeb > 0.2) {
      wingTarget = -1.5
      wingSpeed = 15
    } else if (fling > 0.15) {
      wingTarget = -1.1
      wingSpeed = 9
    } else if (s.swinging) {
      wingTarget = -2.45 + s.pump * 0.12
    } else if (!s.grounded) {
      wingTarget = s.fast ? -0.9 : -1.25
      wingSpeed = s.fast ? 13 : 7
    } else {
      wingTarget = 0.05 + Math.abs(Math.sin(w)) * 0.1 * runAmt
    }
    for (let i = 0; i < 2; i++) {
      const wing = this.wings[i]
      // falling fast: a tiny panic flutter (wide eyes already sell the fall)
      const flapAmp = s.falling && !s.swinging ? 0.55 : 0.4
      const flap = wingSpeed > 0 ? Math.sin(this.t * wingSpeed + (i === 0 ? 0 : 0.35)) * flapAmp : 0
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
