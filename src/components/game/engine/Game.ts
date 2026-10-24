/**
 * Project Duck — game orchestrator (V0.2, swing-first).
 *
 * Fixed-timestep simulation (1/60) with an accumulator. The duck is a
 * kinematic body: gravity, jump, coyote time and jump buffering. Swinging is
 * the star: generous grab range with a visible ring, stable pendulum with
 * directional pumping, momentum-preserving release, and unattended swings
 * keep settling/swaying between grabs.
 *
 * V0.2 additions:
 *  - multiple swings (nearest one is grabbable; others sway in the breeze)
 *  - grab "magnet": 2.1u radius, the seat snaps to the duck's angle on grab
 *  - soft checkpoint respawn (last comfortable landing, not the level start)
 *  - swing-aware camera: pulls back + looks toward the landing while flying
 *  - one-shot teaching tips ('pump') via callbacks
 */

import * as THREE from 'three'
import { PhysicsWorld, type Body } from './Physics'
import { InputState, type InputName } from './Input'
import { Duck } from './Duck'
import { Swing } from './Swing'
import { Background } from './Background'
import { buildLevel, SWINGS, FLAG_X, SPAWN, KILL_Y, PLATFORMS, MOUND_X } from './Level'
import { Sfx } from './Sfx'

const T = {
  gravity: -30,
  maxFall: -24,
  moveSpeed: 4.2,
  groundAccel: 34,
  groundDecel: 38,
  airAccel: 15,
  airDrag: 0.6, // light: preserve swing-release momentum through the air
  jumpVel: 11.2,
  coyote: 0.09,
  buffer: 0.12,
  colliderW: 0.6,
  colliderH: 0.78,
  swingPump: 4.6,
  releaseBoost: 1.05,
  grabRadius: 2.1,
  checkpointMargin: 0.9,
  fixedDt: 1 / 60,
}

function moveToward(v: number, target: number, maxDelta: number): number {
  return v < target ? Math.min(v + maxDelta, target) : Math.max(v - maxDelta, target)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export interface GameCallbacks {
  onPrompt(visible: boolean, label: string): void
  onVictory(won: boolean): void
  onFlash(): void
  /** One-shot contextual teaching tips (ids: 'pump'). */
  onTip(id: string): void
}

interface DebugApi {
  press(name: InputName, down: boolean): void
  tap(name: 'jump' | 'interact'): void
  warp(x: number, y: number): void
  /** Sim-locked: release the active swing on the first sim step matching the window. */
  releaseWhen(minOmega: number, loTheta: number, hiTheta: number): void
  state(): Record<string, number | boolean>
}

export class Game {
  readonly input = new InputState()
  readonly sfx = new Sfx()

  private cb: GameCallbacks
  private canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private world = new PhysicsWorld()
  private duck = new Duck()
  private swings: Swing[] = []
  private activeSwing: Swing | null = null
  private bg: Background
  private levelUpdate: (t: number) => void
  private dirLight: THREE.DirectionalLight

  private body: Body
  private swinging = false
  private coyote = 0
  private jumpBuf = 0
  private won = false
  private hopTimer = 0
  private promptLabel = ''
  private tipSent = { pump: false }
  private checkpoint = { x: SPAWN.x, y: T.colliderH / 2 }
  private debugRelease: { minOmega: number; lo: number; hi: number } | null = null

  private camX = SPAWN.x
  private camY = 1.0
  private camZ = 11
  private camZCur = 11
  private time = 0
  private acc = 0
  private lastT = 0
  private raf = 0
  private disposed = false

  private onKeyDown = (e: KeyboardEvent) => this.key(e, true)
  private onKeyUp = (e: KeyboardEvent) => this.key(e, false)
  private onBlur = () => this.input.clearAll()
  private onResize = () => this.resize()

  constructor(canvas: HTMLCanvasElement, cb: GameCallbacks) {
    this.canvas = canvas
    this.cb = cb

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.06

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 160)

    // ---- lights ----
    const hemi = new THREE.HemisphereLight(0xfff4de, 0x7fae6a, 0.95)
    this.dirLight = new THREE.DirectionalLight(0xffe7bd, 2.2)
    this.dirLight.castShadow = true
    this.dirLight.shadow.mapSize.set(2048, 2048)
    this.dirLight.shadow.camera.near = 1
    this.dirLight.shadow.camera.far = 44
    this.dirLight.shadow.camera.left = -9
    this.dirLight.shadow.camera.right = 9
    this.dirLight.shadow.camera.top = 9
    this.dirLight.shadow.camera.bottom = -7
    this.dirLight.shadow.bias = -0.0004
    this.dirLight.shadow.normalBias = 0.02
    this.scene.add(hemi, this.dirLight, this.dirLight.target)

    // ---- world ----
    this.bg = new Background(this.scene)
    const lv = buildLevel(this.scene, this.world)
    this.levelUpdate = lv.update
    for (const cfg of SWINGS) {
      const s = new Swing(cfg)
      this.swings.push(s)
      this.scene.add(s.group)
    }
    this.scene.add(this.duck.root)

    this.body = {
      x: SPAWN.x,
      y: T.colliderH / 2,
      hw: T.colliderW / 2,
      hh: T.colliderH / 2,
      vx: 0,
      vy: 0,
      onGround: false,
    }
    this.checkpoint = { x: SPAWN.x, y: T.colliderH / 2 }

    // ---- events ----
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    window.addEventListener('resize', this.onResize)
    this.resize()

    this.installDebugHook()

    // ---- loop ----
    this.lastT = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  // ============================ main loop ============================

  private tick = (now: number): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.tick)
    let dt = (now - this.lastT) / 1000
    this.lastT = now
    dt = Math.min(dt, 0.1)
    this.acc += dt
    let steps = 0
    while (this.acc >= T.fixedDt && steps < 5) {
      this.step(T.fixedDt)
      this.acc -= T.fixedDt
      steps++
    }
    if (steps === 5) this.acc = 0
    this.bg.update(dt, this.camX)
    this.levelUpdate(this.time)
    for (const s of this.swings) s.tickVisual(dt, this.time)
    this.renderer.render(this.scene, this.camera)
  }

  private step(dt: number): void {
    this.time += dt
    const b = this.body
    const interact = this.input.consumeInteract()
    const jump = this.input.consumeJump()

    if (this.won) {
      // celebratory hops at the flag
      this.hopTimer -= dt
      if (b.onGround && this.hopTimer <= 0) {
        b.vy = 7.2
        b.onGround = false
        this.duck.onJump()
        this.hopTimer = 0.55
      }
      b.vx = moveToward(b.vx, 0, T.groundDecel * dt)
      const was = b.onGround
      b.vy = Math.max(T.maxFall, b.vy + T.gravity * dt)
      this.world.move(b, dt, was)
      this.syncDuck(dt)
      this.updateCamera(dt)
      return
    }

    if (this.swinging && this.activeSwing) {
      const sw = this.activeSwing
      // pumping: pushing in the direction of motion adds energy (leg pumping)
      const dir = this.input.dir()
      const align = dir !== 0 ? (Math.sign(sw.omega) === dir ? 1 : 0.25) : 0
      const pump = dir * align * T.swingPump
      sw.update(dt, pump, 30)
      for (const s of this.swings) if (s !== sw) s.settle(dt, this.time)
      if (this.debugRelease) {
        const d = this.debugRelease
        if (sw.omega > d.minOmega && sw.theta > d.lo && sw.theta < d.hi) {
          this.debugRelease = null
          this.release()
        }
      }
      const a = sw.seatAnchor()
      b.x = a.x
      b.y = a.y + 0.08 // feet rest on the seat board
      // track tangential velocity so release preserves momentum
      b.vx = sw.omega * sw.L * Math.cos(sw.theta)
      b.vy = sw.omega * sw.L * Math.sin(sw.theta)
      this.setPrompt('LET GO')
      if (jump || interact) this.release()
      this.syncDuck(dt, pump / T.swingPump)
      this.updateCamera(dt)
      return
    }

    // ---- horizontal movement ----
    const dir = this.input.dir()
    if (dir !== 0) {
      const target = dir * T.moveSpeed
      const sameDir = Math.sign(b.vx) === dir
      const over = Math.abs(b.vx) > T.moveSpeed + 0.05
      if (over && sameDir) {
        // preserve hard-earned momentum (e.g. swing releases); settle
        // gently back to run speed only once grounded
        if (b.onGround) b.vx = moveToward(b.vx, target, 8 * dt)
      } else {
        const rate = b.onGround ? T.groundAccel : T.airAccel
        b.vx = moveToward(b.vx, target, rate * dt)
      }
    } else {
      b.vx = moveToward(b.vx, 0, (b.onGround ? T.groundDecel : T.airDrag) * dt)
    }

    // ---- jump with coyote time + input buffer (no double jumps) ----
    this.coyote = b.onGround ? T.coyote : Math.max(0, this.coyote - dt)
    if (jump) this.jumpBuf = T.buffer
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt)
    if (this.jumpBuf > 0 && this.coyote > 0 && b.vy <= 0.01) {
      b.vy = T.jumpVel
      this.jumpBuf = 0
      this.coyote = 0
      b.onGround = false
      this.duck.onJump()
      this.sfx.jump()
    }

    // ---- gravity + collide ----
    const fallBefore = b.vy
    b.vy = Math.max(T.maxFall, b.vy + T.gravity * dt)
    const was = b.onGround
    const res = this.world.move(b, dt, was)
    if (res.landed) {
      const fs = Math.abs(Math.min(0, fallBefore))
      if (fs > 2.5) this.sfx.land()
      this.duck.onLand(fs)
    }

    // ---- remember a comfortable checkpoint on fresh landings ----
    if (res.landed) this.tryCheckpoint()

    // ---- swing interaction: nearest seat within grab range ----
    let nearest: Swing | null = null
    let nearD = Infinity
    for (const s of this.swings) {
      const seat = s.seatAnchor()
      const d = Math.hypot(b.x - seat.x, b.y + 0.35 - seat.y)
      s.setInRange(d < T.grabRadius)
      if (d < T.grabRadius && d < nearD) {
        nearD = d
        nearest = s
      }
    }
    if (nearest) {
      this.setPrompt('GRAB')
      if (interact) this.grab(nearest)
    } else {
      this.setPrompt('')
    }

    // ---- safe recovery when falling out of the level ----
    if (b.y < KILL_Y) this.respawn(true)

    // ---- end flag ----
    if (b.x > FLAG_X - 0.35 && b.onGround) {
      this.won = true
      this.hopTimer = 0.3
      this.sfx.win()
      this.cb.onVictory(true)
    }

    this.syncDuck(dt, 0)
    this.updateCamera(dt)
  }

  // ============================ duck sync ============================

  private syncDuck(dt: number, pump = 0): void {
    const b = this.body
    if (this.swinging && this.activeSwing) {
      if (Math.abs(this.activeSwing.omega) > 0.25) this.duck.facing = this.activeSwing.omega > 0 ? 1 : -1
    } else if (b.vx > 0.25) {
      this.duck.facing = 1
    } else if (b.vx < -0.25) {
      this.duck.facing = -1
    }
    this.duck.root.position.set(b.x, b.y, 0)
    const speed = Math.hypot(b.vx, b.vy)
    this.duck.update(dt, {
      vx: b.vx,
      grounded: b.onGround,
      swinging: this.swinging,
      falling: !b.onGround && b.vy < -3,
      fast: !b.onGround && !this.swinging && speed > 6.4,
      tilt: this.swinging && this.activeSwing ? this.activeSwing.theta : 0,
      pump,
      won: this.won,
    })
    this.dirLight.position.set(b.x + 5, 11, 8)
    this.dirLight.target.position.set(b.x, 0, 0)
  }

  private updateCamera(dt: number): void {
    const b = this.body
    const speedAbs = Math.abs(b.vx)
    // look where the duck is heading; while flying, look further down-range
    const look = this.swinging ? this.duck.facing * 2.0 : this.duck.facing * (0.9 + Math.min(1.1, speedAbs * 0.16))
    const tx = b.x + look
    const ty = Math.max(0.5, b.y * 0.5 + 1.0) + (this.swinging ? 0.4 : 0)
    const kx = 1 - Math.exp(-3.6 * dt)
    const ky = 1 - Math.exp(-3 * dt)
    this.camX += (tx - this.camX) * kx
    this.camY += (ty - this.camY) * ky
    // breathe out slightly while swinging to reveal the landing zone
    const tz = this.resizeZ() * (this.swinging ? 1.12 : 1)
    this.camZCur += (tz - this.camZCur) * Math.min(1, dt * 2.5)
    this.camera.position.set(this.camX, this.camY + 1.5, this.camZCur)
    this.camera.lookAt(this.camX + 0.3, this.camY + 0.35, 0)
  }

  private resizeZ(): number {
    return this.camZ
  }

  // ============================ swing ============================

  private grab(sw: Swing): void {
    const b = this.body
    sw.theta = clamp(sw.angleFrom(b.x, b.y + 0.35), -1.2, 1.2)
    sw.omega = clamp(b.vx / sw.L, -2.6, 2.6)
    this.activeSwing = sw
    this.swinging = true
    b.vx = 0
    b.vy = 0
    b.onGround = false
    for (const s of this.swings) s.setInRange(false)
    sw.bump()
    this.duck.onGrab()
    this.sfx.grab()
    this.sfx.sparkle()
    if (!this.tipSent.pump) {
      this.tipSent.pump = true
      this.cb.onTip('pump')
    }
  }

  private release(): void {
    const sw = this.activeSwing
    if (!sw) return
    const v = sw.releaseVelocity()
    const b = this.body
    b.vx = v.x * T.releaseBoost
    b.vy = Math.max(v.y * T.releaseBoost, -2)
    // the duck kicks off the seat when releasing on a forward swing —
    // a small, readable boost that rewards good timing
    if (sw.omega > 0.3) b.vy += 1.0
    if (Math.abs(b.vx) < 2.4) {
      b.vx = (sw.omega >= 0 ? 1 : -1) * 2.4
    }
    this.swinging = false
    this.activeSwing = null
    b.onGround = false
    this.duck.onJump()
    this.sfx.release()
  }

  // ============================ checkpoints / lifecycle ============================

  private tryCheckpoint(): void {
    const b = this.body
    for (const p of PLATFORMS) {
      if (b.x > p.x1 + T.checkpointMargin && b.x < p.x2 - T.checkpointMargin && Math.abs(b.y - b.hh - p.top) < 0.05) {
        // only forward progress, and never on the mound
        if (b.x > this.checkpoint.x + 0.5 && Math.abs(b.x - MOUND_X) > 1.0) {
          this.checkpoint = { x: b.x, y: p.top + b.hh }
        }
        return
      }
    }
  }

  respawn(withFlash: boolean): void {
    const b = this.body
    b.x = this.checkpoint.x
    b.y = this.checkpoint.y
    b.vx = 0
    b.vy = 0
    b.onGround = false
    this.swinging = false
    this.activeSwing = null
    for (const s of this.swings) s.setInRange(false)
    this.duck.facing = 1
    this.camX = b.x
    this.camY = 1.0
    this.sfx.fall()
    if (withFlash) this.cb.onFlash()
  }

  reset(): void {
    if (this.won) {
      this.won = false
      this.cb.onVictory(false)
    }
    this.hopTimer = 0
    this.debugRelease = null
    this.checkpoint = { x: SPAWN.x, y: T.colliderH / 2 }
    for (const s of this.swings) {
      s.theta = 0
      s.omega = 0
    }
    this.respawn(false)
  }

  private setPrompt(label: string): void {
    if (label !== this.promptLabel) {
      this.promptLabel = label
      this.cb.onPrompt(label !== '', label)
    }
  }

  resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    const t = Math.tan(THREE.MathUtils.degToRad(21))
    const aspect = w / h
    // fit: at least ~8.8 units wide (~7.2 on tall portrait phones) and
    // ~5.6 units tall of gameplay view
    const fitW = aspect < 0.75 ? 7.2 : 8.8
    this.camZ = Math.min(30, Math.max(fitW / (2 * t * aspect), 5.6 / (2 * t)))
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    window.removeEventListener('resize', this.onResize)
    this.renderer.dispose()
  }

  // ============================ input ============================

  private key(e: KeyboardEvent, down: boolean): void {
    if (e.repeat) return
    const c = e.code
    if (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'ArrowUp' || c === 'Space') e.preventDefault()
    if (down) this.sfx.unlock()
    if (c === 'ArrowLeft' || c === 'KeyA') this.input.set('left', down)
    else if (c === 'ArrowRight' || c === 'KeyD') this.input.set('right', down)
    else if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') this.input.set('jump', down)
    else if (c === 'KeyE' || c === 'Enter') this.input.set('interact', down)
    else if (c === 'KeyR' && down) this.reset()
  }

  /** Touch buttons call this. */
  setInput(name: InputName, down: boolean): void {
    this.sfx.unlock()
    this.input.set(name, down)
  }

  /** Toggle sound; returns the new muted state. */
  toggleMute(): boolean {
    this.sfx.muted = !this.sfx.muted
    return this.sfx.muted
  }

  // ============================ debug/test hook ============================

  private installDebugHook(): void {
    const api: DebugApi = {
      press: (name, down) => this.input.set(name, down),
      tap: (name) => {
        this.input.set(name, true)
        window.setTimeout(() => this.input.set(name, false), 60)
      },
      warp: (x, y) => {
        this.body.x = x
        this.body.y = y
        this.body.vx = 0
        this.body.vy = 0
        this.swinging = false
        this.activeSwing = null
      },
      releaseWhen: (minOmega, lo, hi) => {
        this.debugRelease = { minOmega, lo, hi }
      },
      state: () => ({
        time: this.time,
        x: this.body.x,
        y: this.body.y,
        vx: this.body.vx,
        vy: this.body.vy,
        onGround: this.body.onGround,
        swinging: this.swinging,
        won: this.won,
        theta: this.activeSwing?.theta ?? 0,
        omega: this.activeSwing?.omega ?? 0,
        facing: this.duck.facing,
        checkpointX: this.checkpoint.x,
      }),
    }
    ;(window as unknown as { __duck?: DebugApi }).__duck = api
  }
}
