'use client'

/**
 * Project Duck — React shell (V0.9): release-ready game flow.
 *
 * Screens: main menu → playing (pause / settings / level picker reachable
 * from both). Every button works, every setting persists, and the shell is
 * Android-first: multi-touch-safe buttons, safe-area-aware HUD, input
 * dropped on unmount of the contextual GRAB button (the old stuck-tap bug),
 * auto-pause when the app is backgrounded, and a graceful WebGL fallback.
 *
 * Progression (localStorage `duck-save-v2`): highest unlocked level plus
 * per-level best stars & time. Settings (`duck-settings-v1`): mute, SFX and
 * music volume, haptics, graphics tier. No accounts, no cloud.
 */

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Game, type RunStats, type QualityTier } from './engine/Game'
import type { InputName } from './engine/Input'
import { LEVELS } from './engine/levels'
import {
  Home,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

const SAVE_KEY = 'duck-save-v2'
const SETTINGS_KEY = 'duck-settings-v1'

interface LevelRecord {
  completed: boolean
  bestStars: number
  bestTime: number
}

interface SaveData {
  unlocked: number
  best: Record<string, LevelRecord>
}

interface GameSettings {
  muted: boolean
  sfxVol: number
  musicVol: number
  haptics: boolean
  quality: QualityTier
}

function emptyRecord(): LevelRecord {
  return { completed: false, bestStars: 0, bestTime: 0 }
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      const d = JSON.parse(raw) as Partial<SaveData>
      const best: Record<string, LevelRecord> = {}
      for (const def of LEVELS) {
        const r = d.best?.[def.id]
        best[def.id] = r
          ? { completed: !!r.completed, bestStars: Math.max(0, Math.floor(r.bestStars ?? 0)), bestTime: Math.max(0, r.bestTime ?? 0) }
          : emptyRecord()
      }
      return { unlocked: Math.min(LEVELS.length, Math.max(1, Math.floor(d.unlocked ?? 1))), best }
    }
  } catch {
    // corrupted save — start fresh rather than crash
  }
  return { unlocked: 1, best: Object.fromEntries(LEVELS.map((d) => [d.id, emptyRecord()])) }
}

function persistSave(d: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(d))
  } catch {
    // storage unavailable — progression just won't persist
  }
}

const DEFAULT_SETTINGS: GameSettings = {
  muted: false,
  sfxVol: 0.9,
  musicVol: 0.6,
  haptics: true,
  quality: 'balanced',
}

function defaultQuality(): QualityTier {
  // small screens (phones) default to the balanced tier: shadows on at
  // 1024, DPR capped at 1.75 — visually near-identical at phone viewing
  // distance, meaningfully cheaper on mid-range GPUs
  if (typeof window === 'undefined') return 'balanced'
  return Math.min(window.innerWidth, window.innerHeight) < 520 ? 'balanced' : 'high'
}

function loadSettings(): GameSettings {
  const d: GameSettings = { ...DEFAULT_SETTINGS, quality: defaultQuality() }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const s = JSON.parse(raw) as Partial<GameSettings>
      d.muted = !!s.muted
      d.sfxVol = Math.max(0, Math.min(1, Number(s.sfxVol ?? d.sfxVol)))
      d.musicVol = Math.max(0, Math.min(1, Number(s.musicVol ?? d.musicVol)))
      d.haptics = s.haptics !== false
      if (s.quality === 'battery' || s.quality === 'balanced' || s.quality === 'high') d.quality = s.quality
    }
  } catch {
    // corrupted settings — fall through to defaults
  }
  return d
}

function persistSettings(s: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    // storage unavailable — settings just won't persist
  }
}

function fmtTime(t: number): string {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

/** Per-region accent (intro cards, picker overlines, current-region dot). */
const REGION_ACCENT: Record<string, { text: string; dot: string }> = {
  meadow: { text: 'text-emerald-500', dot: 'bg-emerald-400' },
  isles: { text: 'text-teal-500', dot: 'bg-teal-400' },
  canyon: { text: 'text-orange-400', dot: 'bg-orange-400' },
  garden: { text: 'text-violet-400', dot: 'bg-violet-400' },
}

const QUALITY_LABEL: Record<QualityTier, string> = {
  battery: 'Battery',
  balanced: 'Balanced',
  high: 'High',
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [screen, setScreen] = useState<'menu' | 'playing'>('menu')
  const screenRef = useRef<'menu' | 'playing'>('menu')
  const [pausedUI, setPausedUI] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [glError, setGlError] = useState(false)
  const [prompt, setPrompt] = useState<{ visible: boolean; label: string }>({ visible: false, label: '' })
  const [won, setWon] = useState(false)
  const [stats, setStats] = useState<RunStats | null>(null)
  const [newUnlock, setNewUnlock] = useState<number | null>(null)
  const [save, setSave] = useState<SaveData>(() => ({ unlocked: 1, best: {} }))
  const [muted, setMuted] = useState(false)
  const [flash, setFlash] = useState(false)
  const [hint, setHint] = useState(true)
  const [tip, setTip] = useState<string | null>(null)
  const [stars, setStars] = useState({ count: 0, total: LEVELS[0].stars.length })
  const [levelIdx, setLevelIdx] = useState(0)
  const [intro, setIntro] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const introTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seenTips = useRef<Set<string>>(new Set())
  const settingsRef = useRef<GameSettings>(DEFAULT_SETTINGS)
  const gameInstanceRef = useRef<Game | null>(null)

  /** Haptic nudge — respects the toggle, silently no-ops where unsupported. */
  const buzz = (pattern: number | number[]) => {
    if (!settingsRef.current.haptics) return
    try {
      navigator.vibrate?.(pattern)
    } catch {
      // unsupported — fine
    }
  }

  useEffect(() => {
    const saveTimer = setTimeout(() => setSave(loadSave()), 0)
    const canvas = canvasRef.current
    if (!canvas) return

    let g: Game
    try {
      g = new Game(canvas, {
        onPrompt: (visible, label) =>
          setPrompt((p) => (p.visible === visible && p.label === label ? p : { visible, label })),
        onVictory: (w, s) => {
          setWon(w)
          if (w && s) {
            setStats(s)
            setSave((prev) => {
              const def = LEVELS[s.levelIndex]
              const old = prev.best[def.id] ?? emptyRecord()
              const nextUnlocked = Math.min(LEVELS.length, Math.max(prev.unlocked, s.levelIndex + 2))
              if (nextUnlocked > prev.unlocked) setNewUnlock(nextUnlocked)
              const next: SaveData = {
                unlocked: nextUnlocked,
                best: {
                  ...prev.best,
                  [def.id]: {
                    completed: true,
                    bestStars: Math.max(old.bestStars, s.stars),
                    bestTime: old.bestTime > 0 ? Math.min(old.bestTime, s.time) : s.time,
                  },
                },
              }
              persistSave(next)
              return next
            })
          }
        },
        onTip: (id) => {
          if (seenTips.current.has(id)) return
          seenTips.current.add(id)
          setTip(id)
          if (id === 'checkpoint') buzz(12)
          if (id === 'star') buzz(8)
          if (tipTimer.current) clearTimeout(tipTimer.current)
          tipTimer.current = setTimeout(() => setTip(null), 3000)
        },
        onFlash: () => {
          setFlash(true)
          buzz(25) // prick / fall recovery
          if (flashTimer.current) clearTimeout(flashTimer.current)
          flashTimer.current = setTimeout(() => setFlash(false), 240)
        },
        onStars: (count, total) => setStars({ count, total }),
        onCheckpoint: () => {
          // the toast itself is driven by the 'checkpoint' tip
        },
        onLevelStart: (index) => {
          setLevelIdx(index)
          setIntro(true)
          if (introTimer.current) clearTimeout(introTimer.current)
          introTimer.current = setTimeout(() => setIntro(false), 3600)
        },
        onAutoPause: () => {
          // app backgrounded mid-run (or the OS threw the tab away): show
          // the pause menu so returning is always an explicit choice
          if (screenRef.current === 'playing') setPausedUI(true)
        },
      })
    } catch {
      // WebGL unavailable — friendly message, no white screen (deferred to
      // match the shell's deferred-setState pattern)
      setTimeout(() => setGlError(true), 0)
      clearTimeout(saveTimer)
      return
    }

    // apply persisted settings to the fresh game instance (deferred so the
    // first paint matches SSR and we never setState synchronously)
    gameInstanceRef.current = g
    const settingsTimer = setTimeout(() => {
      const s = loadSettings()
      setSettings(s)
      settingsRef.current = s
      const inst = gameInstanceRef.current
      if (inst) {
        inst.sfx.muted = s.muted
        inst.sfx.setSfxVolume(s.sfxVol)
        inst.sfx.setMusicVolume(s.musicVol)
        inst.applyQuality(s.quality)
        inst.setInputBlocked(true) // main menu owns the keyboard at boot
      }
    }, 0)

    setGame(g)
    const hintTimer = setTimeout(() => setHint(false), 5200)
    return () => {
      clearTimeout(saveTimer)
      clearTimeout(settingsTimer)
      clearTimeout(hintTimer)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      if (tipTimer.current) clearTimeout(tipTimer.current)
      if (introTimer.current) clearTimeout(introTimer.current)
      g.dispose()
    }
  }, [])

  // the contextual GRAB button can unmount while a finger is still down
  // (duck moves out of range) — without this, `interact` stays held and the
  // NEXT tap is silently eaten (edge-triggered input never fires)
  useEffect(() => {
    if (!prompt.visible) game?.setInput('interact', false)
  }, [prompt.visible, game])

  // pause overlay <-> engine pause (audio suspends/resumes inside)
  useEffect(() => {
    game?.setPaused(pausedUI)
  }, [pausedUI, game])

  // ---- actions ----

  const enterPlaying = () => {
    screenRef.current = 'playing'
    setScreen('playing')
    setPausedUI(false)
    game?.setInputBlocked(false)
    game?.unlockAudio() // any start path is a user gesture: audio + music wake here
  }

  const goTo = (i: number) => {
    setPickerOpen(false)
    setWon(false)
    setStats(null)
    setNewUnlock(null)
    setPrompt({ visible: false, label: '' })
    enterPlaying()
    game?.loadLevel(i)
  }

  const retryLevel = () => {
    setWon(false)
    setStats(null)
    setNewUnlock(null)
    game?.reset()
  }

  const restartLevel = () => {
    // from the pause menu: same as retry but also leaves the pause state
    setPausedUI(false)
    retryLevel()
  }

  const resume = () => {
    setPausedUI(false) // engine resume (audio) runs in the effect
  }

  const toMenu = () => {
    setPausedUI(false)
    setWon(false)
    setPickerOpen(false)
    setSettingsOpen(false)
    setPrompt({ visible: false, label: '' })
    screenRef.current = 'menu'
    setScreen('menu')
    game?.setInputBlocked(true) // world stays alive as the menu backdrop
  }

  const updateSetting = (patch: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      settingsRef.current = next
      persistSettings(next)
      // apply live — every control here has a real effect or it wouldn't ship
      if (game) {
        if (patch.muted !== undefined || patch.sfxVol !== undefined) {
          game.sfx.muted = next.muted
          game.sfx.setSfxVolume(next.sfxVol)
        }
        if (patch.muted !== undefined || patch.musicVol !== undefined) {
          game.sfx.muted = next.muted
          game.sfx.setMusicVolume(next.musicVol)
        }
        if (patch.quality) game.applyQuality(patch.quality)
      }
      return next
    })
  }

  const toggleMute = () => updateSetting({ muted: !settingsRef.current.muted })

  // ---- touch buttons: multi-finger-safe (a second finger landing on the
  // same button can no longer drop the input when the first finger lifts) ----
  const hold = (name: InputName) => {
    const ids = new Set<number>()
    const sync = () => game?.setInput(name, ids.size > 0)
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
        e.preventDefault()
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId)
        } catch {
          // synthetic/unknown pointer ids (tests, odd devices) — capture is
          // a nice-to-have; the per-id Set below already keeps state sane
        }
        ids.add(e.pointerId)
        sync()
      },
      onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
        e.preventDefault()
        ids.delete(e.pointerId)
        sync()
      },
      onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => {
        ids.delete(e.pointerId)
        sync()
      },
      onLostPointerCapture: (e: ReactPointerEvent<HTMLButtonElement>) => {
        ids.delete(e.pointerId)
        sync()
      },
      onContextMenu: (e: ReactPointerEvent<HTMLButtonElement>) => e.preventDefault(),
    }
  }

  // buzz when a swing first comes into grab range (tiny, informational)
  const prevPrompt = useRef<{ visible: boolean; label: string }>({ visible: false, label: '' })
  useEffect(() => {
    const prev = prevPrompt.current
    if (prompt.visible && prompt.label === 'GRAB' && !(prev.visible && prev.label === 'GRAB')) buzz(6)
    prevPrompt.current = prompt
  }, [prompt.visible, prompt.label])

  const btn =
    'select-none touch-none flex items-center justify-center rounded-full bg-white/90 border border-stone-900/10 shadow-lg shadow-stone-900/10 text-stone-600 active:bg-amber-100 active:scale-95 transition-transform'

  const def = LEVELS[levelIdx]
  const record = save.best[def.id] ?? emptyRecord()
  const isLastLevel = levelIdx >= LEVELS.length - 1
  const accent = REGION_ACCENT[def.theme] ?? REGION_ACCENT.meadow
  const totalStars = LEVELS.reduce((sum, d) => sum + (save.best[d.id]?.bestStars ?? 0), 0)
  const playing = screen === 'playing'

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#fff2d2]" style={{ touchAction: 'none' }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* WebGL unavailable — graceful fallback instead of a white screen */}
      {glError && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-[#fff2d2] px-6">
          <div className="max-w-xs rounded-3xl bg-white/95 p-6 text-center shadow-xl">
            <div className="text-3xl">🦆</div>
            <div className="mt-2 text-base font-extrabold text-stone-700">Duck Adventure</div>
            <p className="mt-2 text-xs font-semibold text-stone-500">
              This browser couldn&apos;t start WebGL, which the game needs to render. Try updating
              your browser or enabling hardware acceleration.
            </p>
          </div>
        </div>
      )}

      {/* respawn flash */}
      <div
        className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-200 ${flash ? 'opacity-80' : 'opacity-0'}`}
      />

      {/* ============================ in-game HUD ============================ */}
      {playing && (
        <div
          className="absolute inset-x-0 top-0 flex items-start justify-between p-3"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          {/* star counter */}
          <div className="flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 shadow-md shadow-stone-900/5">
            <Star size={16} className="fill-amber-400 text-amber-400" />
            <span className="text-sm font-extrabold tabular-nums text-stone-600">
              {stars.count}/{stars.total}
            </span>
            {record.bestStars > 0 && (
              <span className="ml-1 text-[10px] font-bold text-stone-400">BEST {record.bestStars}</span>
            )}
          </div>

          {/* level chip — opens the picker */}
          <button
            aria-label="Open level picker"
            onClick={() => setPickerOpen((v) => !v)}
            className="rounded-full bg-white/85 px-3.5 py-1.5 shadow-md shadow-stone-900/5 transition active:scale-95"
          >
            <span className="flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-stone-600">
              <span className={`h-2 w-2 rounded-full ${accent.dot}`} aria-hidden />
              {levelIdx + 1}/{LEVELS.length} · {def.name}
            </span>
          </button>

          {/* utilities: retry / pause / mute */}
          <div className="flex gap-2">
            <button
              aria-label="Quick retry from checkpoint"
              className={`${btn} h-11 w-11 opacity-80`}
              onClick={() => {
                setWon(false)
                game?.retry()
              }}
            >
              <RotateCcw size={18} />
            </button>
            <button
              aria-label="Pause"
              className={`${btn} h-11 w-11 opacity-80`}
              onClick={() => setPausedUI(true)}
            >
              <Pause size={18} />
            </button>
            <button
              aria-label={settings.muted ? 'Unmute' : 'Mute'}
              className={`${btn} h-11 w-11 opacity-80`}
              onClick={toggleMute}
            >
              {settings.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
        </div>
      )}

      {/* ============================ level picker ============================ */}
      {pickerOpen && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-stone-900/20 p-4" onClick={() => setPickerOpen(false)}>
          <div
            className="w-[min(20rem,86vw)] max-h-[80vh] overflow-y-auto rounded-3xl bg-white/95 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-base font-extrabold text-stone-700">Levels</div>
              <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                <Star size={13} className="fill-amber-400 text-amber-400" />
                {totalStars} collected
              </div>
              <button aria-label="Close level picker" onClick={() => setPickerOpen(false)} className="text-stone-400">
                <X size={18} />
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {LEVELS.map((d, i) => {
                const unlocked = i < save.unlocked
                const r = save.best[d.id] ?? emptyRecord()
                return (
                  <button
                    key={d.id}
                    disabled={!unlocked}
                    onClick={() => goTo(i)}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left transition active:scale-[0.98] ${
                      unlocked ? 'bg-amber-50 hover:bg-amber-100' : 'bg-stone-100 opacity-60'
                    } ${i === levelIdx ? 'ring-2 ring-orange-300' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {unlocked ? (
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-400 text-sm font-extrabold text-white">
                          {i + 1}
                        </span>
                      ) : (
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-stone-200 text-stone-400">
                          <Lock size={14} />
                        </span>
                      )}
                      <div>
                        <div className={`text-[9px] font-extrabold uppercase tracking-widest ${REGION_ACCENT[d.theme]?.text ?? 'text-stone-400'}`}>
                          {d.region}
                        </div>
                        <div className="text-sm font-extrabold text-stone-700">{d.name}</div>
                        <div className="text-[11px] font-semibold text-stone-400">{d.subtitle}</div>
                      </div>
                    </div>
                    {unlocked && (
                      <div className="flex items-center gap-1 text-xs font-extrabold text-stone-500">
                        <Star size={13} className={r.bestStars > 0 ? 'fill-amber-400 text-amber-400' : 'text-stone-300'} />
                        {r.bestStars}/{d.stars.length}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================ main menu ============================ */}
      {screen === 'menu' && !glError && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-gradient-to-b from-[#fff2d2]/60 via-[#fff2d2]/30 to-[#fff2d2]/70 px-6">
          <div className="flex w-[min(21rem,90vw)] flex-col items-center rounded-[2rem] bg-white/90 px-8 py-8 shadow-2xl shadow-stone-900/10 backdrop-blur-sm">
            <div className="text-5xl" aria-hidden>
              🦆
            </div>
            <div className="mt-2 text-center">
              <div className="text-2xl font-black tracking-tight text-stone-700">Duck Adventure</div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-500">
                A tiny swing physics journey
              </div>
            </div>
            <div className="mt-6 flex w-full flex-col gap-2.5">
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-400 py-3.5 text-base font-extrabold tracking-wide text-white shadow-lg shadow-orange-900/20 transition active:scale-95 active:bg-orange-500"
                onClick={() => goTo(save.unlocked - 1)}
              >
                <Play size={18} />
                {save.unlocked > 1 ? `CONTINUE · LEVEL ${save.unlocked}` : 'PLAY'}
              </button>
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-100 py-3 text-sm font-extrabold tracking-wide text-amber-700 transition active:scale-95 active:bg-amber-200"
                onClick={() => setPickerOpen(true)}
              >
                <Star size={15} className="fill-amber-400 text-amber-400" />
                LEVELS · {totalStars} ⭐
              </button>
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-100 py-3 text-sm font-extrabold tracking-wide text-stone-500 transition active:scale-95 active:bg-stone-200"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings size={15} />
                SETTINGS
              </button>
            </div>
            <div className="mt-5 text-[10px] font-bold uppercase tracking-widest text-stone-300">
              rock · release · fly
            </div>
          </div>
        </div>
      )}

      {/* ============================ pause menu ============================ */}
      {pausedUI && !won && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-stone-900/25 px-6 backdrop-blur-[2px]">
          <div className="flex w-[min(19rem,88vw)] flex-col items-center rounded-[1.75rem] bg-white/95 px-7 py-7 shadow-2xl">
            <div className="text-lg font-extrabold text-stone-700">Paused</div>
            <div className="mt-0.5 text-[11px] font-bold uppercase tracking-widest text-stone-400">
              {def.region}
            </div>
            <div className="mt-5 flex w-full flex-col gap-2">
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-400 py-3 text-sm font-extrabold tracking-wide text-white shadow-lg shadow-orange-900/20 transition active:scale-95 active:bg-orange-500"
                onClick={resume}
              >
                <Play size={15} />
                RESUME
              </button>
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-100 py-3 text-sm font-extrabold tracking-wide text-amber-700 transition active:scale-95 active:bg-amber-200"
                onClick={restartLevel}
              >
                <RotateCcw size={15} />
                RESTART LEVEL
              </button>
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-100 py-3 text-sm font-extrabold tracking-wide text-stone-500 transition active:scale-95 active:bg-stone-200"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings size={15} />
                SETTINGS
              </button>
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-100 py-3 text-sm font-extrabold tracking-wide text-stone-500 transition active:scale-95 active:bg-stone-200"
                onClick={toMenu}
              >
                <Home size={15} />
                MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================ settings ============================ */}
      {settingsOpen && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-stone-900/25 p-4" onClick={() => setSettingsOpen(false)}>
          <div
            className="w-[min(20rem,88vw)] rounded-3xl bg-white/95 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-base font-extrabold text-stone-700">Settings</div>
              <button aria-label="Close settings" onClick={() => setSettingsOpen(false)} className="text-stone-400">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <label className="block">
                <span className="text-xs font-extrabold uppercase tracking-widest text-stone-400">Sound effects</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.sfxVol}
                  onChange={(e) => updateSetting({ sfxVol: Number(e.target.value) })}
                  className="mt-1 w-full accent-orange-400"
                  aria-label="Sound effects volume"
                />
              </label>
              <label className="block">
                <span className="text-xs font-extrabold uppercase tracking-widest text-stone-400">Music</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.musicVol}
                  onChange={(e) => updateSetting({ musicVol: Number(e.target.value) })}
                  className="mt-1 w-full accent-orange-400"
                  aria-label="Music volume"
                />
              </label>

              <button
                className="flex items-center justify-between rounded-2xl bg-stone-50 px-4 py-3 text-left"
                onClick={() => updateSetting({ haptics: !settings.haptics })}
                aria-pressed={settings.haptics}
              >
                <span className="text-sm font-extrabold text-stone-600">Vibration</span>
                <span
                  className={`flex h-6 w-11 items-center rounded-full px-0.5 transition ${settings.haptics ? 'justify-end bg-emerald-400' : 'justify-start bg-stone-200'}`}
                >
                  <span className="h-5 w-5 rounded-full bg-white shadow" />
                </span>
              </button>

              <div>
                <span className="text-xs font-extrabold uppercase tracking-widest text-stone-400">Graphics</span>
                <div className="mt-1 flex gap-1.5">
                  {(['battery', 'balanced', 'high'] as QualityTier[]).map((q) => (
                    <button
                      key={q}
                      onClick={() => updateSetting({ quality: q })}
                      aria-pressed={settings.quality === q}
                      className={`flex-1 rounded-xl py-2.5 text-xs font-extrabold transition active:scale-95 ${
                        settings.quality === q ? 'bg-orange-400 text-white shadow' : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {QUALITY_LABEL[q]}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] font-semibold leading-snug text-stone-400">
                  Battery lowers resolution and turns shadows off — the game plays identically.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================ touch controls ============================ */}
      {playing && !pausedUI && !won && (
        <>
          {/* movement buttons (bottom-left) */}
          <div
            className="absolute bottom-0 left-0 flex items-end gap-4 p-5"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <button aria-label="Move left" className={`${btn} h-[76px] w-[76px]`} {...hold('left')}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button aria-label="Move right" className={`${btn} h-[76px] w-[76px]`} {...hold('right')}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          {/* jump + contextual grab (bottom-right) */}
          <div
            className="absolute bottom-0 right-0 flex flex-col items-end gap-3 p-5"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            {prompt.visible && (
              <button
                aria-label={prompt.label}
                className="select-none touch-none flex h-[56px] min-w-[120px] items-center justify-center rounded-2xl bg-orange-400/95 px-4 text-base font-extrabold tracking-wide text-white shadow-lg shadow-orange-900/20 active:scale-95 active:bg-orange-500 transition"
                {...hold('interact')}
              >
                {prompt.label}
              </button>
            )}
            <button
              aria-label="Jump"
              className={`${btn} h-[92px] w-[92px] text-base font-extrabold tracking-widest`}
              {...hold('jump')}
            >
              JUMP
            </button>
          </div>
        </>
      )}

      {/* level intro card (fades) */}
      {playing && (
        <div
          className={`pointer-events-none absolute inset-x-0 top-16 flex justify-center transition-opacity duration-700 ${intro && !pickerOpen ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="flex flex-col items-center gap-1 rounded-3xl bg-white/85 px-6 py-3 text-center shadow-lg shadow-stone-900/5">
            <div className={`text-[11px] font-extrabold uppercase tracking-widest ${accent.text}`}>{def.region}</div>
            <div className="text-base font-extrabold text-stone-700">{def.name}</div>
            <div className="text-xs font-semibold text-stone-500">{def.hint}</div>
          </div>
        </div>
      )}

      {/* fading how-to hint (first session only) */}
      {playing && (
        <div
          className={`pointer-events-none absolute inset-x-0 top-44 flex justify-center transition-opacity duration-1000 ${hint ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-stone-500 shadow-sm">
            Rock ← → while holding the swing to pump higher!
          </div>
        </div>
      )}

      {/* one-shot teaching tips */}
      {tip === 'pump' && (
        <div className="pointer-events-none absolute inset-x-0 top-28 flex justify-center">
          <div className="animate-bounce rounded-full bg-orange-400/95 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-orange-900/20">
            Rock ← → to swing higher — release at the top!
          </div>
        </div>
      )}
      {tip === 'checkpoint' && (
        <div className="pointer-events-none absolute inset-x-0 top-28 flex justify-center">
          <div className="rounded-full bg-emerald-400/95 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-900/20">
            Checkpoint saved!
          </div>
        </div>
      )}
      {tip === 'star' && (
        <div className="pointer-events-none absolute inset-x-0 top-28 flex justify-center">
          <div className="rounded-full bg-amber-400/95 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-amber-900/20">
            Star collected! Find them along your swings.
          </div>
        </div>
      )}

      {/* completion overlay */}
      {won && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-stone-900/10 backdrop-blur-[2px]">
          <div className="w-[min(20rem,86vw)] rounded-3xl bg-white/95 p-6 text-center shadow-2xl">
            {isLastLevel && stats ? (
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-amber-500">
                All levels complete!
              </div>
            ) : (
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-orange-400">
                Level {levelIdx + 1} of {LEVELS.length}
              </div>
            )}
            <div className="mt-0.5 text-xl font-extrabold text-stone-700">{def.name} complete!</div>
            {newUnlock !== null && (
              <div className="mx-auto mt-2 flex w-fit items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-extrabold text-amber-600">
                <Sparkles size={13} />
                {LEVELS[newUnlock]?.region ?? 'New region'} unlocked!
              </div>
            )}
            {stats && (
              <>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Star size={22} className="fill-amber-400 text-amber-400" />
                  <span className="text-lg font-extrabold text-stone-700">
                    {stats.stars}/{stats.starsTotal} stars
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-stone-400">
                  Time {fmtTime(stats.time)}
                  {record.bestStars > 0 && <> · Best {record.bestStars} stars</>}
                  {record.bestTime > 0 && <> · Fastest {fmtTime(record.bestTime)}</>}
                </p>
              </>
            )}
            <div className="mt-5 flex flex-col gap-2">
              {!isLastLevel && (
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-400 py-3 text-sm font-extrabold tracking-wide text-white shadow-lg shadow-orange-900/20 active:scale-95 active:bg-orange-500 transition"
                  onClick={() => goTo(levelIdx + 1)}
                >
                  <Play size={16} />
                  NEXT LEVEL
                </button>
              )}
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-100 py-3 text-sm font-extrabold tracking-wide text-amber-700 active:scale-95 active:bg-amber-200 transition"
                onClick={retryLevel}
              >
                <RotateCcw size={16} />
                {isLastLevel ? 'PLAY AGAIN' : 'RETRY LEVEL'}
              </button>
              <button
                className="text-xs font-bold text-stone-400 underline-offset-2 hover:underline"
                onClick={() => setPickerOpen(true)}
              >
                Choose a level
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
