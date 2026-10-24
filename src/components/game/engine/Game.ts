/**
 * Project Duck — game orchestrator (Phase 4/5/6 controller + camera + loop).
 *
 * Fixed-timestep simulation (1/60) with an accumulator; rendering happens
 * once per animation frame. The duck is a kinematic body: gravity, jump,
 * coyote time and jump buffering give it responsive, playful platformer
 * feel. While swinging, the pendulum drives position and momentum is
 * preserved on release.
 */

import * as THREE from 'three'
import { PhysicsWorld, type Body } from './Physics'
import { InputState, type InputName } from './Input'
import { Duck } from './Duck'
import { Swing } from './Swing'
import { Background } from './Background'
import { buildLevel, SWING_X, FLAG_X, SPAWN, KILL_Y } from './Level'
import { Sfx } from './Sfx'

const T = {
  gravity: -30,
  maxFall: -24,
  moveSpeed: 4.2,
  groundAccel: 34,
  groundDecel: 38,
  airAccel: 15,
  airDrag: 0.6, // light: preserve swing-release momentum through the air
  jumpVel: 11,
  coyote: 0.09,
  buffer: 0.12,
  colliderW: 0.56,
  colliderH: 0.62,
  swingPump: 4.2,
  releaseBoost: 1.05,
  grabRadius: 1.45,
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
}

interface DebugApi {
  press(name: InputName, down: boolean): void
  tap(name: 'jump' | 'interact'): void
  warp(x: number, y: number): void
  /** Sim-locked: release the swing on the first sim step matching the window. */
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
  private swing: Swing
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
  private debugRelease: { minOmega: number; lo: number; hi: number } | null = null

  private camX = SPAWN.x
  private camY = 1.0
  private camZ = 11
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

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 140)

    // ---- lights ----
    const hemi = new THREE.HemisphereLight(0xfff4de, 0x7fae6a, 0.95)
    this.dirLight = new THREE.DirectionalLight(0xffe7bd, 2.2)
    this.dirLight.castShadow = true
    this.dirLight.shadow.mapSize.set(2048, 2048)
    this.dirLight.shadow.camera.near = 1
    this.dirLight.shadow.camera.far = 40
    this.dirLight.shadow.camera.left = -8
    this.dirLight.shadow.camera.right = 8
    this.dirLight.shadow.camera.top = 8
    this.dirLight.shadow.camera.bottom = -6
    this.dirLight.shadow.bias = -0.0004
    this.dirLight.shadow.normalBias = 0.02
    this.scene.add(hemi, this.dirLight, this.dirLight.target)

    // ---- world ----
    this.bg = new Background(this.scene)
    const lv = buildLevel(this.scene, this.world)
    this.levelUpdate = lv.update
    this.swing = new Swing(SWING_X, 0)
    this.scene.add(this.swing.group)
    this.scene.add(this.duck.root)

    this.body = {
      x: SPAWN.x,
      y: SPAWN.y,
      hw: T.colliderW / 2,
      hh: T.colliderH / 2,
      vx: 0,
      vy: 0,
      onGround: false,
    }

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
    this.bg.update(dt)
    this.levelUpdate(this.time)
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

    if (this.swinging) {
      // pumping: pushing in the direction of motion adds energy (like leg
      // pumping); pushing against it mostly just resists.
      const dir = this.input.dir()
      const align = dir !== 0 ? (Math.sign(this.swing.omega) === dir ? 1 : 0.25) : 0
      this.swing.update(dt, dir * align * T.swingPump, 30)
      if (this.debugRelease) {
        const d = this.debugRelease
        if (this.swing.omega > d.minOmega && this.swing.theta > d.lo && this.swing.theta < d.hi) {
          this.debugRelease = null
          this.release()
        }
      }
      const a = this.swing.seatAnchor()
      b.x = a.x
      b.y = a.y + 0.06
      // track tangential velocity so release preserves momentum
      b.vx = this.swing.omega * this.swing.L * Math.cos(this.swing.theta)
      b.vy = this.swing.omega * this.swing.L * Math.sin(this.swing.theta)
      this.setPrompt('LET GO')
      if (jump || interact) this.release()
    } else {
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

      // ---- swing interaction ----
      const seat = this.swing.seatAnchor()
      const near = Math.hypot(b.x - seat.x, b.y + 0.3 - (seat.y + 0.3)) < T.grabRadius
      if (near) {
        this.setPrompt('GRAB')
        if (interact) this.grab()
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
    }

    this.syncDuck(dt)
    this.updateCamera(dt)
  }

  // ============================ duck sync ============================

  private syncDuck(dt: number): void {
    const b = this.body
    if (this.swinging) {
      if (Math.abs(this.swing.omega) > 0.25) this.duck.facing = this.swing.omega > 0 ? 1 : -1
    } else if (b.vx > 0.25) {
      this.duck.facing = 1
    } else if (b.vx < -0.25) {
      this.duck.facing = -1
    }
    this.duck.root.position.set(b.x, b.y, 0)
    this.duck.update(dt, {
      vx: b.vx,
      grounded: b.onGround,
      swinging: this.swinging,
      falling: !b.onGround && b.vy < -3,
      tilt: this.swinging ? this.swing.theta : 0,
    })
    this.dirLight.position.set(b.x + 5, 11, 8)
    this.dirLight.target.position.set(b.x, 0, 0)
  }

  private updateCamera(dt: number): void {
    const b = this.body
    const tx = b.x + this.duck.facing * 0.8
    const ty = Math.max(0.5, b.y * 0.55 + 0.9)
    const kx = 1 - Math.exp(-4 * dt)
    const ky = 1 - Math.exp(-3 * dt)
    this.camX += (tx - this.camX) * kx
    this.camY += (ty - this.camY) * ky
    this.camera.position.set(this.camX, this.camY + 1.5, this.camZ)
    this.camera.lookAt(this.camX + 0.3, this.camY + 0.35, 0)
  }

  // ============================ swing ============================

  private grab(): void {
    const b = this.body
    this.swing.theta = clamp(this.swing.angleFrom(b.x, b.y + 0.4), -1.15, 1.15)
    this.swing.omega = clamp(b.vx / this.swing.L, -2.4, 2.4)
    this.swinging = true
    b.vx = 0
    b.vy = 0
    b.onGround = false
    this.duck.onGrab()
    this.sfx.grab()
  }

  private release(): void {
    const v = this.swing.releaseVelocity()
    this.body.vx = v.x * T.releaseBoost
    this.body.vy = Math.max(v.y * T.releaseBoost, -2)
    // the duck kicks off the seat when releasing on a forward swing —
    // a small, readable boost that rewards good timing
    if (this.swing.omega > 0.3) this.body.vy += 1.0
    if (Math.abs(this.body.vx) < 2.4) {
      this.body.vx = (this.swing.omega >= 0 ? 1 : -1) * 2.4
    }
    this.swinging = false
    this.body.onGround = false
    this.duck.onJump()
    this.sfx.release()
  }

  // ============================ lifecycle ============================

  respawn(withFlash: boolean): void {
    const b = this.body
    b.x = SPAWN.x
    b.y = SPAWN.y
    b.vx = 0
    b.vy = 0
    b.onGround = false
    this.swinging = false
    this.swing.theta = 0
    this.swing.omega = 0
    this.duck.facing = 1
    this.camX = SPAWN.x
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
    // fit: at least ~8.8 units wide and ~5.6 units tall of gameplay view
    this.camZ = Math.min(30, Math.max(8.8 / (2 * t * aspect), 5.6 / (2 * t)))
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
        theta: this.swing.theta,
        omega: this.swing.omega,
        facing: this.duck.facing,
      }),
    }
    ;(window as unknown as { __duck?: DebugApi }).__duck = api
  }
}
