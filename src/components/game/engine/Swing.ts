/**
 * Project Duck — the swing (V0.4, chainable traversal).
 *
 * Two visual families share one stable, analytically integrated pendulum:
 *   frame   — classic playground A-frame standing on a platform or pedestal
 *   hanging — a floating beam (magical hanging structure) with vines and a
 *             lantern; the seat dangles over the gap on long ropes
 *
 * V0.4 chain-system additions:
 *  - per-instance grab range (cfg.range) and settle damping (cfg.damp) so
 *    each swing can feel different (long garden vines vs snappy A-frames)
 *  - attached feedback: ropes warm up + the seat glows softly while held
 *  - release keeps the pendulum's energy, so swings stay swaying and can be
 *    re-grabbed or reused by the next attempt
 */

import * as THREE from 'three'

export interface SwingCfg {
  x: number
  type?: 'frame' | 'hanging'
  baseY?: number // frame: ground/platform top under the frame
  pivotH?: number // frame: pivot height above baseY
  pivotY?: number // hanging: absolute pivot height
  L: number // rope length
  range?: number // grab radius override (default 2.1)
  damp?: number // free-swing damping override (default 1.4)
  maxV?: number // max tangential seat speed m/s (default 11.5) — keeps long ropes from launching rockets
  wood?: number
  woodDark?: number
  rope?: number
}

const UP = new THREE.Vector3(0, 1, 0)

function flatMat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true })
}

/** Rounded-box geometry from an extruded rounded rect (no addons needed). */
export function roundedBoxGeo(w: number, h: number, d: number, r: number): THREE.ExtrudeGeometry {
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001)
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + rr, y)
  s.lineTo(x + w - rr, y)
  s.quadraticCurveTo(x + w, y, x + w, y + rr)
  s.lineTo(x + w, y + h - rr)
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  s.lineTo(x + rr, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - rr)
  s.lineTo(x, y + rr)
  s.quadraticCurveTo(x, y, x + rr, y)
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 4 })
  geo.translate(0, 0, -d / 2)
  return geo
}

export class Swing {
  readonly group = new THREE.Group()
  readonly pivotX: number
  readonly pivotY: number
  readonly L: number
  readonly range: number
  readonly damp: number
  readonly kind: 'frame' | 'hanging'
  readonly maxOmega: number

  theta = 0 // angle from vertical (rad, + = swung to the right)
  omega = 0 // angular velocity (rad/s)

  private seat = new THREE.Group()
  private ring: THREE.Mesh
  private ringVisible = false
  private ropes: THREE.Mesh[] = []
  private ropeMat: THREE.MeshStandardMaterial
  private seatMat: THREE.MeshStandardMaterial
  private anchorZ = [0.4, -0.4]
  private phase: number
  private bumpT = 0
  private heldGlow = 0

  constructor(cfg: SwingCfg) {
    this.kind = cfg.type ?? 'frame'
    this.pivotX = cfg.x
    this.L = cfg.L
    this.range = cfg.range ?? 2.1
    this.damp = cfg.damp ?? 1.4
    this.maxOmega = (cfg.maxV ?? 11.5) / cfg.L
    this.pivotY = this.kind === 'hanging' ? (cfg.pivotY ?? cfg.baseY ?? 0) : (cfg.baseY ?? 0) + (cfg.pivotH ?? 3.5)
    this.phase = cfg.x * 1.7

    const wood = flatMat(cfg.wood ?? 0xd9a05b)
    const woodDark = flatMat(cfg.woodDark ?? 0xb97f45)
    this.ropeMat = new THREE.MeshStandardMaterial({
      color: cfg.rope ?? (this.kind === 'hanging' ? 0x7d9c5e : 0x8a6a4a),
      roughness: 0.75,
      metalness: 0,
    })
    this.seatMat = flatMat(cfg.woodDark ?? 0xb97f45)

    if (this.kind === 'frame') {
      // ---- A-frame: two angled legs per side, classic playground look ----
      const baseY = cfg.baseY ?? 0
      const halfSpan = 1.18
      const legLen = Math.hypot(halfSpan, cfg.pivotH ?? 3.5)
      const legAngle = Math.asin(halfSpan / legLen)
      for (const zs of [0.8, -0.8]) {
        for (const s of [1, -1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.095, legLen, 8), wood)
          leg.position.set(cfg.x + (s * halfSpan) / 2, baseY + (cfg.pivotH ?? 3.5) / 2, zs)
          leg.rotation.z = s * legAngle
          leg.castShadow = true
          this.group.add(leg)
          // rounded foot pad
          const foot = new THREE.Mesh(roundedBoxGeo(0.42, 0.14, 0.34, 0.06), woodDark)
          foot.position.set(cfg.x + s * halfSpan, baseY + 0.07, zs)
          foot.castShadow = true
          this.group.add(foot)
        }
      }
    } else {
      // ---- floating beam: magical hanging structure with vines ----
      const beam = new THREE.Mesh(roundedBoxGeo(2.3, 0.22, 0.5, 0.09), wood)
      beam.position.set(cfg.x, this.pivotY + 0.14, 0)
      beam.castShadow = true
      this.group.add(beam)
      const beamOutline = new THREE.Mesh(roundedBoxGeo(2.3, 0.22, 0.5, 0.09), woodDark)
      beamOutline.scale.set(1.06, 1.28, 1.3)
      beamOutline.position.copy(beam.position)
      beamOutline.position.z -= 0.01
      this.group.add(beamOutline)
      // grassy top of the floating beam
      const moss = new THREE.Mesh(roundedBoxGeo(2.2, 0.1, 0.56, 0.05), flatMat(0x7ecc5a))
      moss.position.set(cfg.x, this.pivotY + 0.3, 0)
      this.group.add(moss)
      // drooping vines at both beam ends
      for (const s of [-1, 1]) {
        const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.8 + (s > 0 ? 0.35 : 0), 5), this.ropeMat)
        vine.position.set(cfg.x + s * 1.05, this.pivotY - 0.28, 0.14)
        this.group.add(vine)
        const leafA = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), flatMat(0x6faf5e))
        leafA.scale.set(1.5, 0.4, 0.8)
        leafA.position.set(cfg.x + s * 1.05 + 0.05, this.pivotY - 0.55, 0.14)
        this.group.add(leafA)
      }
      // little lantern hanging off the side — a warm beacon over the gap
      const lampVine = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.55, 5), this.ropeMat)
      lampVine.position.set(cfg.x - 0.75, this.pivotY - 0.3, -0.18)
      this.group.add(lampVine)
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 9, 7), new THREE.MeshStandardMaterial({
        color: 0xffd98a,
        emissive: 0xffc46a,
        emissiveIntensity: 0.9,
        roughness: 0.4,
      }))
      lamp.position.set(cfg.x - 0.75, this.pivotY - 0.62, -0.18)
      this.group.add(lamp)
      const lampCap = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.08, 7), woodDark)
      lampCap.position.set(cfg.x - 0.75, this.pivotY - 0.53, -0.18)
      this.group.add(lampCap)
    }

    // top bar + end caps + little collars where ropes attach
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.05, 10), wood)
    bar.rotation.x = Math.PI / 2
    bar.position.set(cfg.x, this.pivotY, 0)
    bar.castShadow = true
    this.group.add(bar)
    for (const zs of [1.02, -1.02]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), woodDark)
      cap.position.set(cfg.x, this.pivotY, zs)
      this.group.add(cap)
    }

    // ---- ropes ----
    const ropeGeo = new THREE.CylinderGeometry(0.028, 0.028, 1, 7)
    for (let i = 0; i < 2; i++) {
      const rope = new THREE.Mesh(ropeGeo, this.ropeMat)
      this.ropes.push(rope)
      this.group.add(rope)
    }

    // ---- seat ----
    const board = new THREE.Mesh(roundedBoxGeo(0.88, 0.11, 0.56, 0.05), this.seatMat)
    board.castShadow = true
    this.seat.add(board)
    // subtle plank groove + rope knots
    const groove = new THREE.Mesh(roundedBoxGeo(0.7, 0.024, 0.06, 0.01), wood)
    groove.position.set(0, 0.056, 0)
    this.seat.add(groove)
    for (const zs of this.anchorZ) {
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), this.ropeMat)
      knot.position.set(0, 0.03, zs)
      this.seat.add(knot)
    }
    this.group.add(this.seat)

    // ---- grab range indicator (facing the camera) ----
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.034, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xffb340, transparent: true, opacity: 0.7, fog: false }),
    )
    this.ring.visible = false
    this.group.add(this.ring)

    this.place()
  }

  /** Advance the pendulum while the duck is holding on. */
  update(dt: number, pump: number, gravity: number): void {
    const torque = pump * 2.0
    this.omega += (-(gravity / this.L) * Math.sin(this.theta) - 0.22 * this.omega + torque) * dt
    this.omega = Math.max(-this.maxOmega, Math.min(this.maxOmega, this.omega))
    this.theta += this.omega * dt
    // inelastic angular stop: no rattle, no energy gain at the limits
    if (this.theta > 1.38) {
      this.theta = 1.38
      if (this.omega > 0) this.omega = 0
    } else if (this.theta < -1.38) {
      this.theta = -1.38
      if (this.omega < 0) this.omega = 0
    }
    this.place()
  }

  /** Free-hanging settle (per-swing damping) + a whisper of breeze while unattended. */
  settle(dt: number, t: number): void {
    const breeze = Math.abs(this.omega) < 0.35 ? Math.sin(t * 0.9 + this.phase) * 0.045 : 0
    this.omega += (-(30 / this.L) * Math.sin(this.theta) - this.damp * this.omega + breeze) * dt
    this.theta += this.omega * dt
    this.place()
  }

  private place(): void {
    const sx = this.pivotX + this.L * Math.sin(this.theta)
    const sy = this.pivotY - this.L * Math.cos(this.theta)
    this.seat.position.set(sx, sy, 0)
    this.seat.rotation.z = this.theta
    for (let i = 0; i < 2; i++) {
      const z = this.anchorZ[i]
      const a = new THREE.Vector3(this.pivotX, this.pivotY, z)
      const b = new THREE.Vector3(sx, sy + 0.04, z)
      const dir = b.clone().sub(a)
      const len = Math.max(0.05, dir.length())
      const rope = this.ropes[i]
      rope.position.copy(a).addScaledVector(dir, 0.5)
      rope.scale.set(1, len, 1)
      rope.quaternion.setFromUnitVectors(UP, dir.normalize())
    }
  }

  /** Called every render frame: ring pulse + grab bump + held glow. */
  tickVisual(dt: number, t: number): void {
    if (this.ringVisible) {
      const p = 1 + Math.sin(t * 5.4) * 0.1
      this.ring.scale.set(p, p, 1)
      const m = this.ring.material as THREE.MeshBasicMaterial
      m.opacity = 0.62 + Math.sin(t * 5.4) * 0.22
    }
    this.ring.position.set(this.seat.position.x, this.seat.position.y + 0.02, 0.3)
    if (this.bumpT > 0) {
      this.bumpT = Math.max(0, this.bumpT - dt * 3.2)
      const s = 1 + Math.sin(this.bumpT * Math.PI) * 0.16
      this.seat.scale.set(s, 2 - s, s)
    }
    // held feedback: ropes warm toward gold, seat lifts its glow — subtle
    const target = this.ringVisible ? 0.35 : 0
    this.heldGlow += (target - this.heldGlow) * Math.min(1, dt * 6)
    const g = this.heldGlow
    this.ropeMat.emissive.setRGB(0.55 * g, 0.32 * g, 0.08 * g)
    this.seatMat.emissive.setRGB(0.35 * g, 0.2 * g, 0.05 * g)
  }

  /** Show/hide the "you can grab this" ring. */
  setInRange(v: boolean): void {
    if (this.ringVisible !== v) {
      this.ringVisible = v
      this.ring.visible = v
    }
  }

  /** Happy seat bump when grabbed. */
  bump(): void {
    this.bumpT = 1
  }

  /** Seat center position (duck sits on top of this). */
  seatAnchor(): { x: number; y: number } {
    return {
      x: this.pivotX + this.L * Math.sin(this.theta),
      y: this.pivotY - this.L * Math.cos(this.theta),
    }
  }

  /** Tangential velocity of the seat — momentum is preserved on release. */
  releaseVelocity(): { x: number; y: number } {
    return {
      x: this.omega * this.L * Math.cos(this.theta),
      y: this.omega * this.L * Math.sin(this.theta),
    }
  }

  /** Angle from vertical for a candidate grab point. */
  angleFrom(px: number, py: number): number {
    return Math.atan2(px - this.pivotX, this.pivotY - py)
  }
}
