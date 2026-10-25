'use client'

/**
 * Project Duck — React shell (V0.6): full-screen canvas + Android-style
 * touch controls, per-level star counter, level intro cards, a compact
 * completion flow (retry / next level) and a tiny level picker.
 *
 * Movement buttons bottom-left, big JUMP bottom-right, contextual GRAB /
 * LET GO button appears near the swing. Multi-touch is handled with
 * per-button pointer capture, so holding RUN while tapping JUMP works.
 *
 * Progression (localStorage `duck-save-v2`): highest unlocked level plus
 * per-level best stars & time. No accounts, no cloud, nothing else.
 */

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Game, type RunStats } from './engine/Game'
import type { InputName } from './engine/Input'
import { LEVELS } from './engine/levels'
import { Lock, Play, RotateCcw, Star, Volume2, VolumeX, X } from 'lucide-react'

const SAVE_KEY = 'duck-save-v2'

interface LevelRecord {
  completed: boolean
  bestStars: number
  bestTime: number
}

interface SaveData {
  unlocked: number
  best: Record<string, LevelRecord>
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
    // corrupted save — start fresh
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

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [prompt, setPrompt] = useState<{ visible: boolean; label: string }>({ visible: false, label: '' })
  const [won, setWon] = useState(false)
  const [stats, setStats] = useState<RunStats | null>(null)
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

  useEffect(() => {
    // deferred so the first paint matches SSR and we never setState synchronously
    const saveTimer = setTimeout(() => setSave(loadSave()), 0)
    const canvas = canvasRef.current
    if (!canvas) return
    const g = new Game(canvas, {
      onPrompt: (visible, label) =>
        setPrompt((p) => (p.visible === visible && p.label === label ? p : { visible, label })),
      onVictory: (w, s) => {
        setWon(w)
        if (w && s) {
          setStats(s)
          setSave((prev) => {
            const def = LEVELS[s.levelIndex]
            const old = prev.best[def.id] ?? emptyRecord()
            const next: SaveData = {
              unlocked: Math.min(LEVELS.length, Math.max(prev.unlocked, s.levelIndex + 2)),
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
        if (tipTimer.current) clearTimeout(tipTimer.current)
        tipTimer.current = setTimeout(() => setTip(null), 3000)
      },
      onFlash: () => {
        setFlash(true)
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
    })
    setGame(g)
    const hintTimer = setTimeout(() => setHint(false), 5200)
    return () => {
      clearTimeout(saveTimer)
      clearTimeout(hintTimer)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      if (tipTimer.current) clearTimeout(tipTimer.current)
      if (introTimer.current) clearTimeout(introTimer.current)
      g.dispose()
    }
  }, [])

  const hold = (name: InputName) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      game?.setInput(name, true)
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      game?.setInput(name, false)
    },
    onPointerCancel: () => game?.setInput(name, false),
    onLostPointerCapture: () => game?.setInput(name, false),
    onContextMenu: (e: ReactPointerEvent<HTMLButtonElement>) => e.preventDefault(),
  })

  const btn =
    'select-none touch-none flex items-center justify-center rounded-full bg-white/90 border border-stone-900/10 shadow-lg shadow-stone-900/10 text-stone-600 active:bg-amber-100 active:scale-95 transition-transform'

  const def = LEVELS[levelIdx]
  const record = save.best[def.id] ?? emptyRecord()
  const isLastLevel = levelIdx >= LEVELS.length - 1
  const accent = REGION_ACCENT[def.theme] ?? REGION_ACCENT.meadow

  const goTo = (i: number) => {
    setPickerOpen(false)
    setWon(false)
    setStats(null)
    setPrompt({ visible: false, label: '' })
    game?.loadLevel(i)
  }

  const retryLevel = () => {
    setWon(false)
    setStats(null)
    game?.reset()
  }

  const totalStars = LEVELS.reduce((sum, d) => sum + (save.best[d.id]?.bestStars ?? 0), 0)

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#fff2d2]" style={{ touchAction: 'none' }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* respawn flash */}
      <div
        className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-200 ${flash ? 'opacity-80' : 'opacity-0'}`}
      />

      {/* star counter (top-left, current level) */}
      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 shadow-md shadow-stone-900/5">
        <Star size={16} className="fill-amber-400 text-amber-400" />
        <span className="text-sm font-extrabold tabular-nums text-stone-600">
          {stars.count}/{stars.total}
        </span>
        {record.bestStars > 0 && <span className="ml-1 text-[10px] font-bold text-stone-400">BEST {record.bestStars}</span>}
      </div>

      {/* level chip (top-center) — opens the level picker */}
      <button
        aria-label="Open level picker"
        onClick={() => setPickerOpen((v) => !v)}
        className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/85 px-3.5 py-1.5 shadow-md shadow-stone-900/5 transition active:scale-95"
      >
        <span className="flex items-center gap-1.5 text-xs font-extrabold tracking-wide text-stone-600">
          <span className={`h-2 w-2 rounded-full ${accent.dot}`} aria-hidden />
          {levelIdx + 1}/{LEVELS.length} · {def.name}
        </span>
      </button>

      {/* tiny utility buttons (top-right): quick retry + mute */}
      <div className="absolute right-3 top-3 flex gap-2">
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
          aria-label={muted ? 'Unmute' : 'Mute'}
          className={`${btn} h-11 w-11 opacity-80`}
          onClick={() => {
            if (!game) return
            setMuted(game.toggleMute())
          }}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* level picker panel */}
      {pickerOpen && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-stone-900/20" onClick={() => setPickerOpen(false)}>
          <div
            className="w-[min(20rem,86vw)] rounded-3xl bg-white/95 p-5 shadow-2xl"
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

      {/* level intro card (fades) */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-16 flex justify-center transition-opacity duration-700 ${intro && !pickerOpen ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="flex flex-col items-center gap-1 rounded-3xl bg-white/85 px-6 py-3 text-center shadow-lg shadow-stone-900/5">
          <div className={`text-[11px] font-extrabold uppercase tracking-widest ${accent.text}`}>
            {def.region}
          </div>
          <div className="text-base font-extrabold text-stone-700">{def.name}</div>
          <div className="text-xs font-semibold text-stone-500">{def.hint}</div>
        </div>
      </div>

      {/* fading how-to hint (first session only) */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-44 flex justify-center transition-opacity duration-1000 ${hint ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-stone-500 shadow-sm">
          Rock ← → while holding the swing to pump higher!
        </div>
      </div>

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
