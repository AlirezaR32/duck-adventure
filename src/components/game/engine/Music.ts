/**
 * Project Duck — generative ambient music (V0.9).
 *
 * No audio files: a tiny lookahead scheduler plays a calm pentatonic
 * pluck pattern over slow soft pads, through the shared Sfx music bus
 * (so the music-volume setting and the master mute both apply).
 *
 * Deliberately lightweight: two oscillators + one gain per note, a 250ms
 * scheduler tick, nothing per-frame. The scheduler only runs while
 * `playing` — the game pauses it in the pause menu and when the app is
 * backgrounded (the shared AudioContext is suspended there anyway).
 */

const STEPS_PER_BAR = 8
const STEP_TIME = 60 / 84 / 2 // eighth notes at 84 bpm ≈ 0.357s
const LOOKAHEAD = 0.7 // seconds of notes scheduled ahead of ctx time

// C-major pentatonic across two octaves (Hz), gentle & nursery-soft
const PENT = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.26]

/** Two 8-bar melodies as sparse step patterns (-1 = rest). Section B is the answer phrase. */
const SECTION_A = [0, -1, 2, -1, 4, -1, 3, -1, 2, -1, 4, -1, 5, -1, -1, -1, 3, -1, 2, -1, 0, -1, 1, -1, 2, -1, -1, -1, -1, -1, -1, -1]
const SECTION_B = [5, -1, 4, -1, 3, -1, 4, -1, 2, -1, 3, -1, 1, -1, -1, -1, 0, -1, 2, -1, 3, -1, 1, -1, 0, -1, -1, -1, -1, -1, -1, -1]

export class Music {
  private playing = false
  private timer: ReturnType<typeof setInterval> | null = null
  private ctx: AudioContext | null = null
  private bus: GainNode | null = null
  private nextTime = 0
  private step = 0
  private bar = 0

  /** Begin scheduling (idempotent). Needs a prior user gesture for audio to sound. */
  start(ctx: AudioContext | null, bus: GainNode | null): void {
    if (!ctx || !bus) return
    this.ctx = ctx
    this.bus = bus
    if (this.playing) return
    this.playing = true
    // resume from "now" so a suspend/resume never schedules a burst of
    // stale notes in the past
    this.nextTime = ctx.currentTime + 0.1
    this.timer = setInterval(() => this.tick(), 250)
  }

  /** Stop scheduling (pause menu / backgrounding). Scheduled notes decay on their own. */
  stop(): void {
    this.playing = false
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  get isPlaying(): boolean {
    return this.playing
  }

  private tick(): void {
    const ctx = this.ctx
    const bus = this.bus
    if (!ctx || !bus || !this.playing) return
    if (ctx.state !== 'running') return // suspended: time is frozen, nothing to do
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.scheduleStep(this.nextTime, ctx, bus)
      this.nextTime += STEP_TIME
      this.step++
      if (this.step >= STEPS_PER_BAR) {
        this.step = 0
        this.bar++
      }
    }
  }

  private scheduleStep(t: number, ctx: AudioContext, bus: GainNode): void {
    const section = Math.floor(this.bar / 4) % 2 === 0 ? SECTION_A : SECTION_B
    const idx = ((this.bar % 4) * STEPS_PER_BAR + this.step) % section.length
    const note = section[idx]

    // bar-start pad: a slow soft root/fifth bed under the melody
    if (this.step === 0 && this.bar % 2 === 0) this.pad(t, ctx, bus, this.bar % 4 === 0 ? 130.81 : 98.0)

    if (note < 0) return
    // humanize: tiny detune + velocity variation keeps the loop from droning
    const f = PENT[note] * (this.bar % 8 >= 6 ? 2 : 1) * (1 + (Math.random() - 0.5) * 0.002)
    const vol = 0.055 + Math.random() * 0.03
    this.pluck(t, ctx, bus, f, vol)
    // sparse echo an octave down, one step later, quieter
    if (Math.random() < 0.22) this.pluck(t + STEP_TIME, ctx, bus, f / 2, vol * 0.5)
  }

  /** Short triangle pluck with a fast natural decay. */
  private pluck(t: number, ctx: AudioContext, bus: GainNode, f: number, vol: number): void {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = f
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
    osc.connect(g)
    g.connect(bus)
    osc.start(t)
    osc.stop(t + 0.62)
  }

  /** Very soft sine pad (root + fifth) that swells over a bar. */
  private pad(t: number, ctx: AudioContext, bus: GainNode, f: number): void {
    for (const mult of [1, 1.5]) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f * mult
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.028, t + 0.9)
      g.gain.linearRampToValueAtTime(0.0001, t + 3.4)
      osc.connect(g)
      g.connect(bus)
      osc.start(t)
      osc.stop(t + 3.5)
    }
  }
}
