/**
 * Project Duck — the swing (V0.2).
 *
 * A classic playground A-frame: two angled legs per side (readable "A"
 * silhouette from the gameplay camera), a top bar, two ropes and a wooden
 * seat. The pendulum is analytically integrated (stable, damped, pumpable).
 *
 * V0.2 additions:
 *  - forgiving grab feedback: a pulsing ring appears around the seat when
 *    the duck is in range (setInRange) and the seat does a happy bump on grab
 *  - idle breeze sway so unattended swings feel alive
 *  - per-instance colors/length so the level can have multiple swings
 */

import * as THREE from 'three'

export interface SwingCfg {
  x: number
  baseY: number // ground/platform top under the frame
  L: number // rope length
  pivotH: number // pivot height above baseY
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

  theta = 0 // angle from vertical (rad, + = swung to the right)
  omega = 0 // angular velocity (rad/s)

  private seat = new THREE.Group()
  private ring: THREE.Mesh
  private ringVisible = false
  private ropes: THREE.Mesh[] = []
  private anchorZ = [0.4, -0.4]
  private phase: number
  private bumpT = 0

  constructor(cfg: SwingCfg) {
    this.pivotX = cfg.x
    this.L = cfg.L
    this.pivotY = cfg.baseY + cfg.pivotH
    this.phase = cfg.x * 1.7

    const wood = flatMat(cfg.wood ?? 0xd9a05b)
    const woodDark = flatMat(cfg.woodDark ?? 0xb97f45)
    const ropeMat = new THREE.MeshStandardMaterial({
      color: cfg.rope ?? 0x8a6a4a,
      roughness: 0.75,
      metalness: 0,
    })

    // ---- A-frame: two angled legs per side, classic playground look ----
    const legLen = Math.hypot(1.18, cfg.pivotH)
    const legAngle = Math.asin(1.18 / legLen)
    for (const zs of [0.8, -0.8]) {
      for (const s of [1, -1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.095, legLen, 8), wood)
        leg.position.set(cfg.x + (s * 1.18) / 2, cfg.baseY + cfg.pivotH / 2, zs)
        leg.rotation.z = s * legAngle
        leg.castShadow = true
        this.group.add(leg)
        // rounded foot pad
        const foot = new THREE.Mesh(roundedBoxGeo(0.42, 0.14, 0.34, 0.06), woodDark)
        foot.position.set(cfg.x + s * 1.18, cfg.baseY + 0.07, zs)
        foot.castShadow = true
        this.group.add(foot)
      }
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
      const rope = new THREE.Mesh(ropeGeo, ropeMat)
      this.ropes.push(rope)
      this.group.add(rope)
    }

    // ---- seat ----
    const board = new THREE.Mesh(roundedBoxGeo(0.88, 0.11, 0.56, 0.05), woodDark)
    board.castShadow = true
    this.seat.add(board)
    // subtle plank groove + rope knots
    const groove = new THREE.Mesh(roundedBoxGeo(0.7, 0.024, 0.06, 0.01), wood)
    groove.position.set(0, 0.056, 0)
    this.seat.add(groove)
    for (const zs of this.anchorZ) {
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), ropeMat)
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
    this.omega = Math.max(-4.4, Math.min(4.4, this.omega))
    this.theta += this.omega * dt
    this.theta = Math.max(-1.38, Math.min(1.38, this.theta))
    this.place()
  }

  /** Free-hanging settle (damped) + a whisper of breeze while unattended. */
  settle(dt: number, t: number): void {
    const breeze = Math.abs(this.omega) < 0.35 ? Math.sin(t * 0.9 + this.phase) * 0.045 : 0
    this.omega += (-(30 / this.L) * Math.sin(this.theta) - 1.4 * this.omega + breeze) * dt
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

  /** Called every render frame: ring pulse + grab bump. */
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
