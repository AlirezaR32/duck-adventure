'use client'

/**
 * Project Duck — React shell (V0.4): full-screen canvas + Android-style
 * touch controls, star counter, checkpoint toasts and a compact completion
 * screen. Movement buttons bottom-left, big JUMP bottom-right, contextual
 * GRAB / LET GO button appears near the swing. Multi-touch is handled with
 * per-button pointer capture, so holding RUN while tapping JUMP works.
 *
 * Lightweight progression: best star count + completion are persisted in
 * localStorage — no accounts, no cloud, nothing else.
 */

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Game, type RunStats } from './engine/Game'
import type { InputName } from './engine/Input'
import { Volume2, VolumeX, RotateCcw, Star } from 'lucide-react'

const SAVE_KEY = 'duck-save-v1'

interface SaveData {
  completed: boolean
  bestStars: number
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      const d = JSON.parse(raw) as SaveData
      return { completed: !!d.completed, bestStars: Math.max(0, Math.floor(d.bestStars ?? 0)) }
    }
  } catch {
    // corrupted save — start fresh
  }
  return { completed: false, bestStars: 0 }
}

function persistSave(d: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(d))
  } catch {
    // storage unavailable — progression just won't persist
  }
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [prompt, setPrompt] = useState<{ visible: boolean; label: string }>({ visible: false, label: '' })
  const [won, setWon] = useState(false)
  const [stats, setStats] = useState<RunStats | null>(null)
  const [best, setBest] = useState<SaveData>(() => ({ completed: false, bestStars: 0 }))
  const [muted, setMuted] = useState(false)
  const [flash, setFlash] = useState(false)
  const [hint, setHint] = useState(true)
  const [tip, setTip] = useState<string | null>(null)
  const [stars, setStars] = useState({ count: 0, total: 13 })
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seenTips = useRef<Set<string>>(new Set())

  useEffect(() => {
    // deferred so the first paint matches SSR and we never setState synchronously
    const saveTimer = setTimeout(() => setBest(loadSave()), 0)
    const canvas = canvasRef.current
    if (!canvas) return
    const g = new Game(canvas, {
      onPrompt: (visible, label) =>
        setPrompt((p) => (p.visible === visible && p.label === label ? p : { visible, label })),
      onVictory: (w, s) => {
        setWon(w)
        if (w && s) {
          setStats(s)
          setBest((prev) => {
            const next: SaveData = {
              completed: true,
              bestStars: Math.max(prev.bestStars, s.stars),
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
    })
    setGame(g)
    const hintTimer = setTimeout(() => setHint(false), 5200)
    return () => {
      clearTimeout(saveTimer)
      clearTimeout(hintTimer)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      if (tipTimer.current) clearTimeout(tipTimer.current)
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

  const playAgain = () => {
    setStats(null)
    game?.reset()
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#fff2d2]" style={{ touchAction: 'none' }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* respawn flash */}
      <div
        className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-200 ${flash ? 'opacity-80' : 'opacity-0'}`}
      />

      {/* star counter (top-left) */}
      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 shadow-md shadow-stone-900/5">
        <Star size={16} className="fill-amber-400 text-amber-400" />
        <span className="text-sm font-extrabold tabular-nums text-stone-600">
          {stars.count}/{stars.total}
        </span>
        {best.bestStars > 0 && (
          <span className="ml-1 text-[10px] font-bold text-stone-400">BEST {best.bestStars}</span>
        )}
      </div>

      {/* tiny utility buttons (top-right): quick retry + mute */}
      <div className="absolute right-3 top-3 flex gap-2">
        <button
          aria-label="Quick retry from checkpoint"
          className={`${btn} h-11 w-11 opacity-80`}
          onClick={() => game?.retry()}
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

      {/* fading how-to hint */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-16 flex justify-center transition-opacity duration-1000 ${hint ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-stone-500 shadow-sm">
          Run with the arrows · JUMP the gap · GRAB the swing!
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
        <div className="absolute inset-0 grid place-items-center bg-stone-900/10 backdrop-blur-[2px]">
          <div className="w-[min(20rem,86vw)] rounded-3xl bg-white/95 p-6 text-center shadow-2xl">
            <div className="text-xl font-extrabold text-stone-700">Level complete!</div>
            <p className="mt-2 text-sm text-stone-500">
              The duck swung across the whole fantasy isles — grab, pump, release, repeat!
            </p>
            {stats && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Star size={22} className="fill-amber-400 text-amber-400" />
                <span className="text-lg font-extrabold text-stone-700">
                  {stats.stars}/{stats.starsTotal} stars
                </span>
              </div>
            )}
            {best.bestStars > 0 && (
              <p className="mt-1 text-xs font-semibold text-stone-400">Best: {best.bestStars} stars</p>
            )}
            <button
              className="mt-5 w-full rounded-2xl bg-orange-400 py-3 text-sm font-extrabold tracking-wide text-white shadow-lg shadow-orange-900/20 active:scale-95 active:bg-orange-500 transition"
              onClick={playAgain}
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
