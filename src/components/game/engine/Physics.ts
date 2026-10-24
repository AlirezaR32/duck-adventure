/**
 * Project Duck — minimal 2D-plane physics for a 2.5D platformer.
 *
 * Axis-aligned boxes on the x/y plane. The duck is a kinematic body moved
 * with axis-separated sweep + substepping so it can never tunnel through
 * ordinary platforms, and landing is detected explicitly.
 *
 * Collision geometry is fully independent of the visual squash & stretch:
 * this module never sees animation data.
 */

export interface Box {
  cx: number
  cy: number
  hw: number
  hh: number
}

export interface Body {
  x: number
  y: number
  hw: number
  hh: number
  vx: number
  vy: number
  onGround: boolean
}

export interface MoveResult {
  hitX: boolean
  landed: boolean
  headBump: boolean
}

/** Max distance moved per collision substep (must stay below smallest platform half-thickness). */
const MAX_SUBSTEP = 0.2
const GROUND_PROBE = 0.09

export class PhysicsWorld {
  readonly boxes: Box[] = []

  add(cx: number, cy: number, w: number, h: number): Box {
    const b: Box = { cx, cy, hw: w / 2, hh: h / 2 }
    this.boxes.push(b)
    return b
  }

  private overlaps(x: number, y: number, hw: number, hh: number, b: Box): boolean {
    return Math.abs(x - b.cx) < hw + b.hw && Math.abs(y - b.cy) < hh + b.hh
  }

  /** Height of the nearest surface directly under the body (within probe), or null. */
  groundBelow(b: Body): number | null {
    for (const box of this.boxes) {
      if (Math.abs(b.x - box.cx) < b.hw + box.hw - 0.02) {
        const top = box.cy + box.hh
        const gap = b.y - b.hh - top
        if (gap >= -0.02 && gap <= GROUND_PROBE) return top
      }
    }
    return null
  }

  /**
   * Move a body by velocity * dt with substeps and axis-separated resolution.
   * Sets `b.onGround` fresh each call. Returns collision events.
   */
  move(b: Body, dt: number, wasOnGround: boolean): MoveResult {
    const dx = b.vx * dt
    const dy = b.vy * dt
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_SUBSTEP))
    const sdx = dx / steps
    const sdy = dy / steps

    let hitX = false
    let landed = false
    let headBump = false
    b.onGround = false

    for (let i = 0; i < steps; i++) {
      if (sdx !== 0) {
        b.x += sdx
        for (const box of this.boxes) {
          if (this.overlaps(b.x, b.y, b.hw, b.hh, box)) {
            b.x = sdx > 0 ? box.cx - box.hw - b.hw : box.cx + box.hw + b.hw
            hitX = true
          }
        }
      }
      if (sdy !== 0) {
        b.y += sdy
        for (const box of this.boxes) {
          if (this.overlaps(b.x, b.y, b.hw, b.hh, box)) {
            if (sdy < 0) {
              b.y = box.cy + box.hh + b.hh
              b.onGround = true
              if (!wasOnGround) landed = true
            } else {
              b.y = box.cy - box.hh - b.hh
              headBump = true
            }
            b.vy = 0
          }
        }
      }
    }

    if (hitX) b.vx = 0
    if (headBump && b.vy > 0) b.vy = 0

    // Belt-and-suspenders ground probe for the resting-on-floor case.
    if (!b.onGround && sdy <= 0 && this.groundBelow(b) !== null) {
      b.onGround = true
    }

    return { hitX, landed, headBump }
  }
}
