/**
 * Project Duck — game orchestrator (V0.6, multi-level).
 *
 * Fixed-timestep simulation (1/60) with an accumulator. The duck is a
 * kinematic body: gravity, jump with anticipation, coyote time and jump
 * buffering. Swinging is the star — grab, pump, release, fly, land:
 *
 *  - every swing is independent (own pivot, length, damping, grab range)
 *  - release preserves the pendulum's tangential momentum
 *  - a short re-grab cooldown on the swing you just left prevents accidental
 *    re-attaches, while any OTHER swing in range can be grabbed instantly
 *  - explicit checkpoint posts activate as you pass them; respawning resets
 *    physics, swing attachments and input safely (never mid-air stale state)
 *  - moving platforms carry the duck via the physics carrier (deterministic)
 *
 * V0.6 adds a reusable level system: levels are data (levels.ts) built by
 * buildLevelRuntime; loadLevel() tears the previous level down completely
 * (scene objects, physics boxes, swings, progression) so repeated switches
 * and restarts can never leak stale state. One Game instance serves the
 * whole session — input handlers and the RAF loop are never duplicated.
 */

import * as THREE from 'three'
import { PhysicsWorld, type Body, type Box } from './Physics'
import { InputState, type InputName } from './Input'
import { Duck } from './Duck'
import { Swing } from './Swing'
import { Background } from './Background'
import { buildLevelRuntime, type LevelHandle } from './Level'
import { LEVELS, type CheckpointDef, type LevelDef, type PlatDef } from './levels'
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
  releaseBoost: 1.12,
  forwardKick: 1.15,
  regrabCooldown: 0.24,
  starRadius: 0.95,
  fixedDt: 1 / 60,
}

function moveToward(v: number, target: number, maxDelta: number): number {
  return v < target ? Math.min(v + maxDelta, target) : Math.max(v - maxDelta, target)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export interface RunStats {
  stars: number
  starsTotal: number
  levelIndex: number
  levelName: string
  /** Seconds from level start to the flag (fixed-step clock). */
  time: number
}

export interface GameCallbacks {
  onPrompt(visible: boolean, label: string): void
  onVictory(won: boolean, stats?: RunStats): void
  onFlash(): void
  /** One-shot contextual teaching tips (ids: 'pump', 'checkpoint', 'star'). */
  onTip(id: string): void
  /** Lightweight progression events for HUD counters. */
  onStars(count: number, total: number): void
  onCheckpoint(index: number, total: number): void
  /** Fired after a level finished loading (also on construction). */
  onLevelStart(index: number, def: LevelDef): void
}

interface DebugApi {
  press(name: InputName, down: boolean): void
  tap(name: 'jump' | 'interact'): void
  warp(x: number, y: number): void
  /** Sim-locked: release the active swing on the first sim step matching the window. */
  releaseWhen(minOmega: number, loTheta: number, hiTheta: number): void
  respawnNow(): void
  fullReset(): void
  /** Teleport just above a point, zero velocity (for arc verification). */
  place(x: number, y: number): void
  /** Deterministic testing: advance exactly n fixed sim steps (visuals kept coherent). */
  sim(n: number): void
  /** Load a level by index (used by the UI and the test harness). */
  loadLevel(i: number): void
  state(): Record<string, number | boolean>
}

interface Particle {
  mesh: THREE.Mesh
  vx: number
  vy: number
  spin: number
  life: number
  max: number
  grow: number
  gravity: number
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
  /** Built in the constructor via loadLevel() before the first tick. */
  private level!: LevelHandle
  private levelIdx = 0
  private def: LevelDef = LEVELS[0]
  private plats: PlatDef[] = []
  private checkpoints: CheckpointDef[] = []
  private flagX = 0
  private spawnX = 0.4
  private killY = -8
  private moverBoxes: Box[] = []
  private levelTime = 0
  private dirLight: THREE.DirectionalLight

  private body: Body
  private swinging = false
  private coyote = 0
  private jumpBuf = 0
  private won = false
  private hopTimer = 0
  private promptLabel = ''
  private tipSent: Record<string, boolean> = { pump: false, star: false }
  private debugRelease: { minOmega: number; lo: number; hi: number } | null = null

  // ---- swing chain state ----
  private regrabSwing: Swing | null = null
  private regrabT = 0
  private whooshT = 0
  private creakT = 0
  private glintCool = new WeakMap<Swing, number>()

  // ---- progression state ----
  private cpIndex = -1 // latest activated checkpoint
  private starsGot = 0
  private confetti: Particle[] = []
  private confettiGeo = new THREE.OctahedronGeometry(0.05, 0)
  private confettiColors = [0xffb65c, 0xff8ba0, 0x9fd8e8, 0xb4e97c, 0xffd166]

  private camX = 0.4
  private camY = 1.0
  private camZ = 11
  private camZCur = 11
  private smVx = 0 // smoothed horizontal velocity for camera look-ahead
  private time = 0
  private acc = 0
  private lastT = 0
  private raf = 0
  private disposed = false

  private onKeyDown = (e: KeyboardEvent) => this.key(e, true)
  private onKeyUp = (e: KeyboardEvent) => this.key(e, false)
  private onBlur = () => this.input.clearAll()
  private onResize = () => this.resize()

  constructor(canvas: HTMLCanvasElement, cb: GameCallbacks, startLevel = 0) {
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
    const hemi = new THREE.HemisphereLight(0xfff4de, 0x8fb377, 0.95)
    this.dirLight = new THREE.DirectionalLight(0xffe7bd, 2.2)
    this.dirLight.castShadow = true
    // phones get a 1024 shadow map — at their viewing distance the quality
    // difference is invisible, but the fill-cost saving is real
    const shadowRes = Math.min(window.innerWidth, window.innerHeight) < 520 ? 1024 : 2048
    this.dirLight.shadow.mapSize.set(shadowRes, shadowRes)
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
    this.scene.add(this.duck.root)
    this.scene.add(this.duck.shadowMesh)

    this.body = {
      x: 0.4,
      y: T.colliderH / 2,
      hw: T.colliderW / 2,
      hh: T.colliderH / 2,
      vx: 0,
      vy: 0,
      onGround: false,
      carrier: null,
    }

    this.loadLevel(startLevel)

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

  // ============================ level lifecycle ============================

  /** Tear the current level down completely, then build level `idx` fresh. */
  loadLevel(idx: number): void {
    const i = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(idx)))
    this.levelIdx = i
    const def = LEVELS[i]
    this.def = def

    // ---- teardown: scene objects, swings, physics ----
    if (this.level) this.level.dispose()
    for (const s of this.swings) {
      this.scene.remove(s.group)
      s.dispose()
    }
    this.swings = []
    this.world.reset()

    // ---- build ----
    this.level = buildLevelRuntime(this.scene, this.world, def)
    for (const cfg of def.swings) {
      const s = new Swing(cfg)
      this.swings.push(s)
      this.scene.add(s.group)
    }
    this.moverBoxes = this.world.boxes.filter((b) => this.world.motionOf(b) !== undefined)

    // ---- per-level play state (no stale forces, attachments or counters) ----
    this.plats = def.platforms
    this.checkpoints = def.checkpoints
    this.flagX = def.flagX
    this.spawnX = def.spawnX
    this.killY = def.killY
    this.levelTime = 0
    this.cpIndex = -1
    this.starsGot = 0
    this.tipSent = { pump: false, star: false }
    this.clearConfetti()
    this.won = false
    this.hopTimer = 0
    this.swinging = false
    this.activeSwing = null
    this.regrabSwing = null
    this.regrabT = 0
    this.whooshT = 0
    this.debugRelease = null
    this.input.clearAll()

    const b = this.body
    b.x = def.spawnX
    b.y = T.colliderH / 2
    b.vx = 0
    b.vy = 0
    b.onGround = false
    b.carrier = null
    this.duck.facing = 1
    this.camX = def.spawnX
    this.camY = 1.0
    this.smVx = 0

    this.bg.applyTheme(def.theme)
    this.cb.onStars(0, def.stars.length)
    this.cb.onVictory(false)
    this.cb.onLevelStart(i, def)
  }

  private clearConfetti(): void {
    for (const p of this.confetti) {
      this.scene.remove(p.mesh)
      ;(p.mesh.material as THREE.Material).dispose()
    }
    this.confetti = []
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
    this.level.update(this.time)
    for (const s of this.swings) s.tickVisual(dt, this.time)
    this.tickConfetti(dt)
    this.renderer.render(this.scene, this.camera)
  }

  private step(dt: number): void {
    this.time += dt
    // moving platforms advance once per fixed step, before anything moves;
    // a grounded duck then rides its carrier by the platform's exact delta
    this.world.updateMotions(this.time)
    const b = this.body
    if (b.onGround && b.carrier) {
      const m = this.world.motionOf(b.carrier)
      if (m) {
        b.x += m.dx
        b.y += m.dy
      }
    }
    if (!this.won) this.levelTime += dt
    const interact = this.input.consumeInteract()
    const jump = this.input.consumeJump()
    this.regrabT = Math.max(0, this.regrabT - dt)
    if (this.regrabT === 0) this.regrabSwing = null

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
      for (const s of this.swings) s.settle(dt, this.time)
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
      // the ropes creak softly when the duck works the swing hard or sweeps
      // near the top of the arc — quiet, occasional, part of the world
      this.creakT -= dt
      if ((Math.abs(pump) > 2.2 || Math.abs(sw.theta) > 1.02) && this.creakT <= 0) {
        this.sfx.creak()
        this.creakT = 0.5 + Math.random() * 0.4
      }
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
      // airy whoosh when sweeping through the bottom of the arc at speed
      this.whooshT -= dt
      if (Math.abs(sw.omega) > 3.1 && Math.abs(sw.theta) < 0.24 && this.whooshT <= 0) {
        this.sfx.whoosh()
        this.whooshT = 0.6
      }
      this.collectStars()
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

    // unattended swings keep settling/swaying between grabs — released
    // swings must actually lose energy, otherwise they spin forever and
    // their seats never come back within grab range
    for (const s of this.swings) s.settle(dt, this.time)

    // ---- jump with coyote time + input buffer (no double jumps) ----
    this.coyote = b.onGround ? T.coyote : Math.max(0, this.coyote - dt)
    if (jump) this.jumpBuf = T.buffer
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt)
    if (this.jumpBuf > 0 && this.coyote > 0 && b.vy <= 0.01) {
      b.vy = T.jumpVel
      this.jumpBuf = 0
      this.coyote = 0
      b.onGround = false
      this.duck.onJump(true)
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
    if (res.landed && this.checkCheckpoints()) {
      // a fresh checkpoint activation gets a tiny celebration
      const cp = this.checkpoints[this.cpIndex]
      this.duck.celebrate()
      this.sfx.chime()
      if (cp) this.burst(cp.x, cp.y + 1.3, 12)
      this.cb.onTip('checkpoint')
      this.cb.onCheckpoint(this.cpIndex + 1, this.checkpoints.length)
    }

    // ---- footsteps follow the run cycle ----
    if (b.onGround && Math.abs(b.vx) > 0.8) {
      if (this.duck.consumeStep()) {
        this.stepAlt = !this.stepAlt
        this.sfx.step(this.stepAlt)
      }
    }

    // ---- swing interaction: nearest seat within ITS grab range, preferring
    // the swing the duck is moving toward (never grabs a seat behind its
    // back when the next swing ahead is also in range) ----
    const moveDir = Math.abs(b.vx) > 0.5 ? Math.sign(b.vx) : 0
    let nearest: Swing | null = null
    let nearScore = Infinity
    for (const s of this.swings) {
      const seat = s.seatAnchor()
      const d = Math.hypot(b.x - seat.x, b.y + 0.35 - seat.y)
      const wasInRange = s.inRangeNow
      const inRange = d < s.range && !(s === this.regrabSwing && this.regrabT > 0)
      s.setInRange(inRange)
      // first moment a swing becomes reachable: a soft glint + tiny sparkle
      // helps players read WHERE the next interaction lives (edge-triggered,
      // cooled down so cruising past swings never turns into a siren)
      if (inRange && !wasInRange && !this.swinging) {
        const last = this.glintCool.get(s) ?? -9
        if (this.time - last > 1.4) {
          this.glintCool.set(s, this.time)
          this.sfx.glint()
          this.burst(seat.x, seat.y + 0.3, 4)
        }
      }
      if (inRange) {
        const ahead = moveDir !== 0 ? Math.max(0, moveDir * (seat.x - b.x)) : 0
        const score = d - 0.45 * Math.min(1.2, ahead)
        if (score < nearScore) {
          nearScore = score
          nearest = s
        }
      }
    }
    if (nearest) {
      this.setPrompt('GRAB')
      if (interact) this.grab(nearest)
    } else {
      this.setPrompt('')
    }

    this.collectStars()

    // ---- safe recovery when falling out of the level ----
    if (b.y < this.killY) this.respawn(true)

    // ---- end flag ----
    if (b.x > this.flagX - 0.35 && b.onGround) {
      this.won = true
      this.hopTimer = 0.3
      this.sfx.win()
      this.burst(b.x, b.y + 1.2, 26)
      this.burst(b.x - 1.2, b.y + 2.2, 18)
      this.burst(b.x + 1.2, b.y + 2.2, 18)
      this.cb.onVictory(true, {
        stars: this.starsGot,
        starsTotal: this.level.stars.length,
        levelIndex: this.levelIdx,
        levelName: this.def.name,
        time: this.levelTime,
      })
    }

    this.syncDuck(dt, 0)
    this.updateCamera(dt)
  }

  // ============================ stars ============================

  private collectStars(): void {
    const b = this.body
    for (const s of this.level.stars) {
      if (s.taken) continue
      if (Math.hypot(b.x - s.x, b.y + 0.4 - s.y) < T.starRadius) {
        s.taken = true
        s.mesh.visible = false
        this.starsGot++
        this.sfx.collect()
        this.burst(s.x, s.y, 10)
        this.cb.onStars(this.starsGot, this.level.stars.length)
        if (!this.tipSent.star) {
          this.tipSent.star = true
          this.cb.onTip('star')
        }
      }
    }
  }

  // ============================ confetti (shared bursts) ============================

  private burst(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        this.confettiGeo,
        new THREE.MeshBasicMaterial({
          color: this.confettiColors[i % this.confettiColors.length],
          transparent: true,
          opacity: 0.95,
        }),
      )
      m.position.set(x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.5)
      m.scale.setScalar(0.7 + Math.random() * 0.9)
      const a = Math.random() * Math.PI * 2
      const sp = 1.6 + Math.random() * 2.6
      this.confetti.push({
        mesh: m,
        vx: Math.cos(a) * sp,
        vy: 2.4 + Math.random() * 3,
        spin: (Math.random() - 0.5) * 16,
        life: 0.75 + Math.random() * 0.4,
        max: 1.15,
        grow: 0.1,
        gravity: 6.5,
      })
      this.scene.add(m)
    }
  }

  private tickConfetti(dt: number): void {
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const p = this.confetti[i]
      p.life -= dt
      if (p.life <= 0) {
        this.scene.remove(p.mesh)
        ;(p.mesh.material as THREE.Material).dispose()
        this.confetti.splice(i, 1)
        continue
      }
      p.vy -= p.gravity * dt
      p.vx *= 1 - 0.9 * dt
      p.mesh.position.x += p.vx * dt
      p.mesh.position.y += p.vy * dt
      p.mesh.rotation.x += p.spin * dt
      p.mesh.rotation.y += p.spin * 0.6 * dt
      ;(p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, p.life / 0.4)
    }
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
    // highest surface below the duck — feeds the contact shadow and
    // gives the player a readable landing cue over gaps (movers included)
    let groundY = -8
    const consider = (x1: number, x2: number, top: number) => {
      if (b.x >= x1 - 0.25 && b.x <= x2 + 0.25 && top <= b.y - b.hh + 0.08 && top > groundY) groundY = top
    }
    for (const p of this.plats) consider(p.x1, p.x2, p.top)
    for (const box of this.moverBoxes) consider(box.cx - box.hw, box.cx + box.hw, box.cy + box.hh)
    const speed = Math.hypot(b.vx, b.vy)
    this.duck.update(dt, {
      vx: b.vx,
      vy: b.vy,
      grounded: b.onGround,
      swinging: this.swinging,
      falling: !b.onGround && b.vy < -3,
      fast: !b.onGround && !this.swinging && speed > 6.4,
      tilt: this.swinging && this.activeSwing ? this.activeSwing.theta : 0,
      pump,
      won: this.won,
      groundY,
    })
    this.dirLight.position.set(b.x + 5, 11, 8)
    this.dirLight.target.position.set(b.x, 0, 0)
  }

  private updateCamera(dt: number): void {
    const b = this.body
    // look-ahead follows SMOOTHED velocity: anticipates launches and fast
    // flights without ever snapping or oscillating
    this.smVx += (b.vx - this.smVx) * Math.min(1, dt * 3.2)
    const airborneFast = !b.onGround && !this.swinging && Math.abs(this.smVx) > 6
    let lead = clamp(this.smVx * (airborneFast ? 0.62 : 0.45), -3.4, 3.4)
    // while swinging, lean the frame into the arc's travel direction so the
    // landing zone stays readable through the widest part of the sweep
    if (this.swinging && this.activeSwing) {
      lead += clamp(this.activeSwing.omega * this.activeSwing.L * 0.075, -1.1, 1.1)
    }
    const look = lead + this.duck.facing * 0.35
    const tx = b.x + look
    const ty = Math.max(0.5, b.y * 0.5 + 1.0) + (this.swinging ? 0.4 : 0)
    const kx = 1 - Math.exp(-3.6 * dt)
    const ky = 1 - Math.exp(-3 * dt)
    this.camX += (tx - this.camX) * kx
    this.camY += (ty - this.camY) * ky
    // breathe out slightly while swinging to reveal the landing zone
    const tz = this.camZ * (this.swinging ? 1.12 : 1)
    this.camZCur += (tz - this.camZCur) * Math.min(1, dt * 2.5)
    this.camera.position.set(this.camX, this.camY + 1.5, this.camZCur)
    this.camera.lookAt(this.camX + 0.3, this.camY + 0.35, 0)
  }

  // ============================ swing chain ============================

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
    if (sw.omega > 0.3) b.vy += T.forwardKick
    if (Math.abs(b.vx) < 2.4) {
      b.vx = (sw.omega >= 0 ? 1 : -1) * 2.4
    }
    this.swinging = false
    this.activeSwing = null
    // brief cooldown so flying past THIS swing doesn't instantly re-grab it;
    // any other swing in range stays grabbable for mid-air chains. The base
    // cooldown scales with release speed: a hard launch leaves the old
    // swing's grab zone later, so it must stay locked longer (a weak drop
    // only locks it for a blink, keeping low-release re-grabs snappy).
    this.regrabSwing = sw
    this.regrabT = T.regrabCooldown + Math.min(0.55, Math.hypot(b.vx, b.vy) * 0.05)
    b.onGround = false
    this.duck.onJump()
    this.duck.onRelease()
    this.sfx.release()
  }

  // ============================ checkpoints / lifecycle ============================

  /** Activate the next checkpoint when the duck lands on its platform. */
  private checkCheckpoints(): boolean {
    const b = this.body
    for (let i = this.cpIndex + 1; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i]
      const p = this.plats[cp.plat]
      if (!p) continue
      if (b.x > p.x1 + 0.3 && b.x < p.x2 - 0.3 && Math.abs(b.y - b.hh - cp.y) < 0.4) {
        this.cpIndex = i
        this.level?.setCheckpointActive(i)
        return true
      }
    }
    return false
  }

  respawn(withFlash: boolean): void {
    const cp = this.cpIndex >= 0 ? this.checkpoints[this.cpIndex] : { x: this.spawnX, y: 0 }
    const b = this.body
    b.x = cp.x
    b.y = cp.y + T.colliderH / 2 + 0.02
    b.vx = 0
    b.vy = 0
    b.onGround = false
    b.carrier = null
    this.swinging = false
    this.activeSwing = null
    this.regrabSwing = null
    this.regrabT = 0
    this.debugRelease = null
    for (const s of this.swings) s.setInRange(false)
    this.duck.facing = 1
    this.duck.dizzy()
    this.camX = b.x
    this.camY = Math.max(1.0, b.y)
    this.sfx.fall()
    if (withFlash) this.cb.onFlash()
  }

  reset(): void {
    if (this.won) {
      this.won = false
      this.cb.onVictory(false)
    }
    this.hopTimer = 0
    this.cpIndex = -1
    this.starsGot = 0
    this.levelTime = 0
    this.tipSent = { pump: false, star: false }
    for (const s of this.level.stars) {
      s.taken = false
      s.mesh.visible = true
    }
    this.cb.onStars(0, this.level.stars.length)
    for (const s of this.swings) {
      s.theta = 0
      s.omega = 0
    }
    this.respawn(false)
  }

  /** Quick retry: back to the latest checkpoint, stars kept. */
  retry(): void {
    if (this.won) {
      this.won = false
      this.cb.onVictory(false)
    }
    this.respawn(true)
  }

  /** Full restart from the very beginning (PLAY AGAIN). */
  fullReset(): void {
    this.reset()
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
    else if (c === 'KeyR' && down) this.retry()
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

  private stepAlt = false

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
        this.body.carrier = null
        this.swinging = false
        this.activeSwing = null
      },
      place: (x, y) => {
        this.body.x = x
        this.body.y = y
        this.body.vx = 4.2
        this.body.vy = 0
        this.body.carrier = null
        this.swinging = false
        this.activeSwing = null
      },
      releaseWhen: (minOmega, lo, hi) => {
        this.debugRelease = { minOmega, lo, hi }
      },
      respawnNow: () => this.respawn(true),
      fullReset: () => this.fullReset(),
      loadLevel: (i: number) => this.loadLevel(i),
      sim: (n) => {
        const steps = Math.max(0, Math.min(900, Math.floor(n)))
        for (let i = 0; i < steps; i++) {
          this.step(T.fixedDt)
          this.acc = 0
          this.bg.update(T.fixedDt, this.camX)
          this.level.update(this.time)
          for (const s of this.swings) s.tickVisual(T.fixedDt, this.time)
          this.tickConfetti(T.fixedDt)
        }
        // render only for larger batches — hot test loops call sim(1) and
        // the live RAF loop repaints whatever the final state is anyway
        if (steps >= 5) this.renderer.render(this.scene, this.camera)
      },
      state: () => {
        let nearD = -1
        let inRange = false
        let maxSwingOmega = 0
        for (const s of this.swings) {
          const seat = s.seatAnchor()
          const d = Math.hypot(this.body.x - seat.x, this.body.y + 0.35 - seat.y)
          if (nearD < 0 || d < nearD) nearD = d
          if (d < s.range) inRange = true
          maxSwingOmega = Math.max(maxSwingOmega, Math.abs(s.omega))
        }
        // nearest moving platform (rides are tested against this)
        let moverX = 0
        let moverTop = 0
        let moverD = Infinity
        for (const box of this.moverBoxes) {
          const d = Math.abs(this.body.x - box.cx)
          if (d < moverD) {
            moverD = d
            moverX = box.cx
            moverTop = box.cy + box.hh
          }
        }
        return {
          time: this.time,
          level: this.levelIdx,
          x: this.body.x,
          y: this.body.y,
          vx: this.body.vx,
          vy: this.body.vy,
          onGround: this.body.onGround,
          swinging: this.swinging,
          won: this.won,
          theta: this.activeSwing?.theta ?? 0,
          omega: this.activeSwing?.omega ?? 0,
          swingX: this.activeSwing ? this.activeSwing.pivotX : 0,
          facing: this.duck.facing,
          cp: this.cpIndex,
          stars: this.starsGot,
          swings: this.swings.length,
          checkpoints: this.checkpoints.length,
          movers: this.moverBoxes.length,
          moverX: Math.round(moverX * 100) / 100,
          moverTop: Math.round(moverTop * 100) / 100,
          nearD: Math.round(nearD * 100) / 100,
          inRange,
          maxSwingOmega: Math.round(maxSwingOmega * 100) / 100,
          drawCalls: this.renderer.info.render.calls,
          triangles: this.renderer.info.render.triangles,
        }
      },
    }
    ;(window as unknown as { __duck?: DebugApi }).__duck = api
  }
}
