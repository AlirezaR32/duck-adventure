/**
 * Project Duck — tiny WebAudio synth for game feel.
 * No audio files: every sound is generated on the fly. Includes a mute
 * toggle, a persisted SFX volume and a dedicated music bus (Music.ts
 * schedules into it) so the two volumes are independently adjustable.
 */

export class Sfx {
  muted = false
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  /** Shared music bus — Music.ts connects its scheduler output here. */
  private music: GainNode | null = null
  private musicVol = 0.6
  private sfxVol = 1

  /** Create/resume the AudioContext — must be called from a user gesture at least once. */
  unlock(): void {
    this.ensure()
  }

  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AC) return null
        this.ctx = new AC()
        this.master = this.ctx.createGain()
        this.applyGains()
        this.master.connect(this.ctx.destination)
        this.music = this.ctx.createGain()
        this.music.gain.value = this.musicVol * 0.5
        this.music.connect(this.ctx.destination)
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    } catch {
      return null
    }
  }

  /** The shared AudioContext for the music scheduler (created on demand). */
  contextForMusic(): AudioContext | null {
    return this.ensure()
  }

  /** Destination node music should connect into (created on demand). */
  musicBus(): GainNode | null {
    this.ensure()
    return this.music
  }

  /** 0..1 SFX loudness (UI setting); combined with the master mute. */
  setSfxVolume(v: number): void {
    this.sfxVol = Math.max(0, Math.min(1, v))
    this.applyGains()
  }

  /** 0..1 music loudness (UI setting). Applies live to the music bus. */
  setMusicVolume(v: number): void {
    this.musicVol = Math.max(0, Math.min(1, v))
    this.applyGains()
  }

  private applyGains(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5 * this.sfxVol
    // music rides its own bus (independent of the SFX volume) but the master
    // mute must silence it too
    if (this.music && this.ctx) {
      this.music.gain.setTargetAtTime(this.muted ? 0 : this.musicVol * 0.5, this.ctx.currentTime, 0.05)
    }
  }

  /** True when the underlying AudioContext is currently suspended. */
  isSuspended(): boolean {
    return this.ctx?.state === 'suspended'
  }

  /** Suspend all audio (pause menu / app backgrounded). Reversible. */
  suspendAll(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }

  /** Resume audio after suspendAll() (must follow a user gesture on some browsers). */
  resumeAll(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private tone(o: { f0: number; f1: number; dur: number; type: OscillatorType; vol: number; delay?: number }): void {
    if (this.muted || this.sfxVol <= 0) return
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const t0 = ctx.currentTime + (o.delay ?? 0)
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = o.type
    osc.frequency.setValueAtTime(Math.max(30, o.f0), t0)
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), t0 + o.dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(o.vol, t0 + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t0)
    osc.stop(t0 + o.dur + 0.05)
  }

  private noise(dur: number, vol: number, f0: number, f1: number): void {
    if (this.muted || this.sfxVol <= 0) return
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const t0 = ctx.currentTime
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.1
    bp.frequency.setValueAtTime(f0, t0)
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(bp)
    bp.connect(g)
    g.connect(this.master)
    src.start(t0)
    src.stop(t0 + dur)
  }

  jump(): void {
    this.tone({ f0: 300, f1: 660, dur: 0.16, type: 'triangle', vol: 0.15 })
    // a whisper of takeoff texture so the jump leaves the ground audibly
    this.noise(0.05, 0.035, 1200, 400)
  }
  land(): void {
    this.tone({ f0: 150, f1: 82, dur: 0.11, type: 'sine', vol: 0.2 })
    this.noise(0.06, 0.07, 900, 300)
  }
  /** Tiny alternating footstep tick — deliberately very quiet. */
  step(alt: boolean): void {
    const v = 0.94 + Math.random() * 0.12 // small natural variation
    this.noise(0.035, 0.028, (alt ? 2100 : 1700) * v, 500)
  }
  grab(): void {
    this.tone({ f0: 520, f1: 330, dur: 0.1, type: 'triangle', vol: 0.16 })
  }
  /** Bright little chime for pickups/grab confirmation. */
  sparkle(): void {
    this.tone({ f0: 880, f1: 1320, dur: 0.08, type: 'sine', vol: 0.07 })
    this.tone({ f0: 1320, f1: 1760, dur: 0.1, type: 'sine', vol: 0.055, delay: 0.05 })
  }
  /** Star pickup: a happy two-note blip, brighter than the grab sparkle. */
  collect(): void {
    const v = 0.97 + Math.random() * 0.06
    this.tone({ f0: 990 * v, f1: 990 * v, dur: 0.07, type: 'triangle', vol: 0.11 })
    this.tone({ f0: 1480 * v, f1: 1480 * v, dur: 0.12, type: 'triangle', vol: 0.1, delay: 0.07 })
  }
  /** Warm two-note "checkpoint saved" chime. */
  chime(): void {
    this.tone({ f0: 660, f1: 660, dur: 0.14, type: 'sine', vol: 0.13 })
    this.tone({ f0: 880, f1: 880, dur: 0.2, type: 'sine', vol: 0.12, delay: 0.12 })
  }
  /** Soft airy whoosh when the swing carries the duck through the arc fast. */
  whoosh(): void {
    this.noise(0.3, 0.07, 700, 2000)
  }
  /** Subtle wooden rope creak while working the swing hard. Very quiet. */
  creak(): void {
    const f = 96 + Math.random() * 40
    this.tone({ f0: f, f1: f * 0.82, dur: 0.12, type: 'sawtooth', vol: 0.028 })
    this.noise(0.1, 0.012, 500, 260)
  }
  /** Soft two-tone glint when a swing first comes into grab range. */
  glint(): void {
    this.tone({ f0: 1180, f1: 1560, dur: 0.09, type: 'sine', vol: 0.045 })
  }
  /** Short "ouch" prick when the duck bumps a thorn burr. Quiet, comical. */
  prick(): void {
    this.tone({ f0: 330, f1: 95, dur: 0.13, type: 'sawtooth', vol: 0.06 })
    this.noise(0.07, 0.045, 1500, 320)
  }
  release(): void {
    this.noise(0.24, 0.13, 500, 2400)
  }
  fall(): void {
    this.tone({ f0: 420, f1: 110, dur: 0.4, type: 'sine', vol: 0.13 })
  }
  win(): void {
    const notes = [523, 659, 784, 1046]
    notes.forEach((f, i) => this.tone({ f0: f, f1: f, dur: 0.17, type: 'triangle', vol: 0.14, delay: i * 0.11 }))
  }
}
