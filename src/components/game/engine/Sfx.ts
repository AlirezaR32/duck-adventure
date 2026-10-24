/**
 * Project Duck — tiny WebAudio synth for game feel.
 * No audio files: every sound is generated on the fly. Includes a mute toggle.
 */

export class Sfx {
  muted = false
  private ctx: AudioContext | null = null
  private master: GainNode | null = null

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
        this.master.gain.value = 0.5
        this.master.connect(this.ctx.destination)
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    } catch {
      return null
    }
  }

  private tone(o: { f0: number; f1: number; dur: number; type: OscillatorType; vol: number; delay?: number }): void {
    if (this.muted) return
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
    if (this.muted) return
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
  }
  land(): void {
    this.tone({ f0: 150, f1: 82, dur: 0.11, type: 'sine', vol: 0.2 })
    this.noise(0.06, 0.07, 900, 300)
  }
  grab(): void {
    this.tone({ f0: 520, f1: 330, dur: 0.1, type: 'triangle', vol: 0.16 })
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
