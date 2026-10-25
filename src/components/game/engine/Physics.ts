/**
 * Project Duck — minimal 2D-plane physics for a 2.5D platformer.
 *
 * Axis-aligned boxes on the x/y plane. The duck is a kinematic body moved
 * with axis-separated sweep + substepping so it can never tunnel through
 * ordinary platforms, and landing is detected explicitly.
 *
 * V0.6: moving platforms. A box can carry a sinusoidal motion on one axis;
 * the world advances every motion once per fixed step (updateMotions) and
 * bodies standing on a mover are carried by its exact delta, so rides are
 * deterministic under the fixed timestep.
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
  /** Box the body is standing on this step (used to ride moving platforms). */
  carrier: Box | null
}

/** Sinusoidal motion for a moving platform (one axis). */
export interface Motion {
  axis: 'x' | 'y'
  base: number
  amp: number
  speed: number
  phase: number
  /** Delta the box moved during the latest updateMotions() call. */
  dx: number
  dy: number
}

export interface MotionDef {
  axis: 'x' | 'y'
  amp: number
  speed: number
  phase: number
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
  private motions = new Map<Box, Motion>()

  add(cx: number, cy: number, w: number, h: number): Box {
    const b: Box = { cx, cy, hw: w / 2, hh: h / 2 }
    this.boxes.push(b)
    return b
  }

  /** Register a moving platform (sinusoidal on one axis around its center). */
  addMoving(cx: number, cy: number, w: number, h: number, def: MotionDef): Box {
    const box = this.add(cx, cy, w, h)
    this.motions.set(box, {
      axis: def.axis,
      base: def.axis === 'x' ? cx : cy,
      amp: def.amp,
      speed: def.speed,
      phase: def.phase,
      dx: 0,
      dy: 0,
    })
    return box
  }

  motionOf(box: Box): Motion | undefined {
    return this.motions.get(box)
  }

  get motionCount(): number {
    return this.motions.size
  }

  /**
   * Advance every moving platform to time t (seconds). Call exactly once
   * per fixed sim step, BEFORE bodies are moved; carried bodies then get
   * shifted by the stored delta.
   */
  updateMotions(t: number): void {
    for (const [box, m] of this.motions) {
      const v = m.base + m.amp * Math.sin(t * m.speed + m.phase)
      if (m.axis === 'x') {
        m.dx = v - box.cx
        m.dy = 0
        box.cx = v
      } else {
        m.dy = v - box.cy
        m.dx = 0
        box.cy = v
      }
    }
  }

  /** Remove every box and motion (level switch). */
  reset(): void {
    this.boxes.length = 0
    this.motions.clear()
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
    b.carrier = null

    for (let i = 0; i < steps; i++) {
      if (sdx !== 0) {
        b.x += sdx
        for (const box of this.boxes) {
          // corner forgiveness: when the feet are within a step of a box's
          // top surface, don't treat it as a wall — the y pass will seat the
          // body on top. Prevents permanent jams on ledge corners.
          if (b.y - b.hh < box.cy + box.hh - 0.04 && this.overlaps(b.x, b.y, b.hw, b.hh, box)) {
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
              b.carrier = box
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
    // It can catch the final approach one step BEFORE the collision sweep
    // would, so it must snap to the surface AND emit the landing event —
    // otherwise landings are silently eaten (no dust, no sfx, no checkpoint).
    if (!b.onGround && sdy <= 0) {
      const top = this.groundBelow(b)
      if (top !== null) {
        b.y = top + b.hh
        b.vy = 0
        b.onGround = true
        b.carrier = this.carrierBelow(b)
        if (!wasOnGround) landed = true
      }
    }

    return { hitX, landed, headBump }
  }

  /** The box directly under a resting body (matching groundBelow's pick). */
  private carrierBelow(b: Body): Box | null {
    for (const box of this.boxes) {
      if (Math.abs(b.x - box.cx) < b.hw + box.hw - 0.02) {
        const top = box.cy + box.hh
        const gap = b.y - b.hh - top
        if (gap >= -0.02 && gap <= GROUND_PROBE) return box
      }
    }
    return null
  }
}
