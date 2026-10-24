/**
 * Project Duck — the swing (Phase 6 proof of concept).
 *
 * One stable pivot, two visible ropes, one seat, controlled pendulum motion.
 * Ropes are plain cylinders re-anchored every frame from pivot to seat —
 * no rope simulation, as specified.
 */

import * as THREE from 'three'

const WOOD = 0xd9a05b
const WOOD_DARK = 0xc4884a
const ROPE = 0x3a3330

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
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 3 })
  geo.translate(0, 0, -d / 2)
  return geo
}

const UP = new THREE.Vector3(0, 1, 0)

export class Swing {
  readonly group = new THREE.Group()
  readonly pivotX: number
  readonly pivotY: number
  readonly L: number

  theta = 0 // angle from vertical (rad, + = swung to the right)
  omega = 0 // angular velocity (rad/s)

  private seat = new THREE.Group()
  private ropes: THREE.Mesh[] = []
  private anchorZ = [0.34, -0.34]

  constructor(x: number, groundY: number) {
    this.pivotX = x
    this.L = 3.1
    this.pivotY = groundY + 3.55 // seat rests at groundY + 0.45

    const wood = flatMat(WOOD)
    const woodDark = flatMat(WOOD_DARK)
    const ropeMat = new THREE.MeshStandardMaterial({ color: ROPE, roughness: 0.7, metalness: 0 })

    // A-frame posts (front/back in z, so the side view stays readable)
    const postH = this.pivotY - groundY
    for (const zs of [0.95, -0.95]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, postH, 8), wood)
      post.position.set(this.pivotX, groundY + postH / 2, zs)
      post.castShadow = true
      this.group.add(post)
      // foot pad
      const foot = new THREE.Mesh(roundedBoxGeo(0.5, 0.16, 0.4, 0.07), woodDark)
      foot.position.set(this.pivotX, groundY + 0.08, zs)
      foot.castShadow = true
      this.group.add(foot)
    }

    // top bar
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 2.1, 8), wood)
    bar.rotation.x = Math.PI / 2
    bar.position.set(this.pivotX, this.pivotY, 0)
    bar.castShadow = true
    this.group.add(bar)
    for (const zs of [1.05, -1.05]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 6), woodDark)
      cap.position.set(this.pivotX, this.pivotY, zs)
      this.group.add(cap)
    }

    // two ropes (thin cylinders, re-anchored each frame)
    const ropeGeo = new THREE.CylinderGeometry(0.024, 0.024, 1, 6)
    for (let i = 0; i < 2; i++) {
      const rope = new THREE.Mesh(ropeGeo, ropeMat)
      this.ropes.push(rope)
      this.group.add(rope)
    }

    // seat
    const seatBoard = new THREE.Mesh(roundedBoxGeo(0.8, 0.1, 0.52, 0.045), woodDark)
    seatBoard.castShadow = true
    this.seat.add(seatBoard)
    for (const zs of this.anchorZ) {
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), ropeMat)
      knot.position.set(0, 0.02, zs)
      this.seat.add(knot)
    }
    this.group.add(this.seat)

    this.place()
  }

  /** Advance the pendulum while the duck is holding on. */
  update(dt: number, pump: number, gravity: number): void {
    const torque = pump * 2.0
    this.omega += (-(gravity / this.L) * Math.sin(this.theta) - 0.22 * this.omega + torque) * dt
    this.omega = Math.max(-4.2, Math.min(4.2, this.omega))
    this.theta += this.omega * dt
    this.theta = Math.max(-1.35, Math.min(1.35, this.theta))
    this.place()
  }

  /** Free-hanging settle (damped) while nobody is on it. */
  settle(dt: number): void {
    this.omega += (-(30 / this.L) * Math.sin(this.theta) - 1.4 * this.omega) * dt
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
