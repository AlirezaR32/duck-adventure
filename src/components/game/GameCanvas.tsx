'use client'

/**
 * Project Duck — React shell: full-screen canvas + Android-style touch
 * controls. Movement buttons bottom-left, big JUMP bottom-right, contextual
 * GRAB / LET GO button appears near the swing. Multi-touch is handled with
 * per-button pointer capture, so holding RUN while tapping JUMP works.
 */

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Game } from './engine/Game'
import type { InputName } from './engine/Input'
import { Volume2, VolumeX, RotateCcw } from 'lucide-react'

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [prompt, setPrompt] = useState<{ visible: boolean; label: string }>({ visible: false, label: '' })
  const [won, setWon] = useState(false)
  const [muted, setMuted] = useState(false)
  const [flash, setFlash] = useState(false)
  const [hint, setHint] = useState(true)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const g = new Game(canvas, {
      onPrompt: (visible, label) =>
        setPrompt((p) => (p.visible === visible && p.label === label ? p : { visible, label })),
      onVictory: setWon,
      onFlash: () => {
        setFlash(true)
        if (flashTimer.current) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setFlash(false), 240)
      },
    })
    setGame(g)
    const hintTimer = setTimeout(() => setHint(false), 5200)
    return () => {
      clearTimeout(hintTimer)
      if (flashTimer.current) clearTimeout(flashTimer.current)
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

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#fff2d2]" style={{ touchAction: 'none' }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* respawn flash */}
      <div
        className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-200 ${flash ? 'opacity-80' : 'opacity-0'}`}
      />

      {/* tiny utility buttons (top-right) */}
      <div className="absolute top-3 right-3 flex gap-2">
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
        <button
          aria-label="Restart"
          className={`${btn} h-11 w-11 opacity-80`}
          onClick={() => game?.reset()}
        >
          <RotateCcw size={18} />
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
          Hold arrows to run · JUMP to hop · GRAB the swing
        </div>
      </div>

      {/* victory overlay */}
      {won && (
        <div className="absolute inset-0 grid place-items-center bg-stone-900/10 backdrop-blur-[2px]">
          <div className="w-[min(20rem,86vw)] rounded-3xl bg-white/95 p-6 text-center shadow-2xl">
            <div className="text-xl font-extrabold text-stone-700">Level complete!</div>
            <p className="mt-2 text-sm text-stone-500">
              The duck cleared the V0 test course — run, jumps, obstacle and the big swing.
            </p>
            <button
              className="mt-5 w-full rounded-2xl bg-orange-400 py-3 text-sm font-extrabold tracking-wide text-white shadow-lg shadow-orange-900/20 active:scale-95 active:bg-orange-500 transition"
              onClick={() => game?.reset()}
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
