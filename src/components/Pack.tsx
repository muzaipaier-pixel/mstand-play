// ─── Pack: the foil pack, idle bob + tear gesture ───────────────────────────
// Interaction (research §3.1 / §4.2):
//   • Idle: 4s sine bob, a sheen sweep across the foil, pointer tilt parallax.
//   • Tear: drag in any direction (≥55% of ~110px commits, otherwise the
//     strip springs back) or tap for an auto-tear. While the strip peels,
//     light leaks from the pack mouth in the colour of the best card inside
//     — decided before the gesture starts (honest foreshadowing), with
//     crinkle sounds tracking the drag.
//   • On commit the parent switches to the burst phase; this component then
//     flies the strip off and drops the empty pack body away.

import { useEffect, useRef } from 'react'
import { m, useMotionValue, useTransform, animate } from 'motion/react'
import { tearCrinkle } from '../audio/sfx'

const PACK_URL = `${import.meta.env.BASE_URL}pack.webp`
const TEAR_DISTANCE = 110

interface PackProps {
  /** aura colour of the best card in the prepared pack */
  leakColor: string
  leakRgb: string
  phase: 'idle' | 'burst'
  /** increment to trigger a programmatic (button) auto-tear */
  tearSignal: number
  reducedMotion: boolean
  interactive: boolean
  onFirstTouch: () => void
  onCommitTear: () => void
}

export function Pack({
  leakColor,
  leakRgb,
  phase,
  tearSignal,
  reducedMotion,
  interactive,
  onFirstTouch,
  onCommitTear,
}: PackProps) {
  const progress = useMotionValue(0)
  const stripY = useTransform(progress, [0, 1], [0, -96])
  const stripRotate = useTransform(progress, [0, 1], [0, -15])
  const stripX = useTransform(progress, [0, 1], [0, -16])
  const leakOpacity = useTransform(progress, [0.04, 1], [0, 1])
  const haloScale = useTransform(progress, [0, 1], [0.7, 1.25])

  const drag = useRef<{ x: number; y: number; t: number; active: boolean; lastCrinkle: number }>({
    x: 0,
    y: 0,
    t: 0,
    active: false,
    lastCrinkle: 0,
  })
  const committed = useRef(false)
  const prepared = useRef(false)

  const commit = () => {
    if (committed.current) return
    committed.current = true
    animate(progress, 1, { duration: reducedMotion ? 0.05 : 0.22, ease: 'easeOut' })
    onCommitTear()
  }

  const autoTear = () => {
    if (committed.current || !interactive) return
    if (!prepared.current) {
      prepared.current = true
      onFirstTouch()
    }
    animate(progress, 1, {
      duration: reducedMotion ? 0.08 : 0.72,
      ease: [0.3, 0.6, 0.4, 1],
      onUpdate: (v) => {
        if (v > 0.25 && v < 0.9 && Math.random() < 0.3) tearCrinkle()
      },
      onComplete: commit,
    })
  }

  // Button-driven tear (App increments tearSignal after preparing the pack).
  // Initialised to the current signal so a remounted pack doesn't auto-tear.
  const lastSignal = useRef(tearSignal)
  useEffect(() => {
    if (tearSignal > lastSignal.current) {
      lastSignal.current = tearSignal
      prepared.current = true
      autoTear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tearSignal])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive || committed.current) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), active: true, lastCrinkle: 0 }
    if (!prepared.current) {
      prepared.current = true
      onFirstTouch()
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement
    if (drag.current.active && !committed.current) {
      const dist = Math.max(Math.abs(e.clientX - drag.current.x), Math.abs(e.clientY - drag.current.y))
      const p = Math.min(dist / TEAR_DISTANCE, 1)
      progress.set(p)
      if (dist - drag.current.lastCrinkle > 26) {
        drag.current.lastCrinkle = dist
        tearCrinkle()
      }
    } else if (!committed.current) {
      // idle tilt parallax
      const rect = el.getBoundingClientRect()
      const mx = (e.clientX - rect.left) / rect.width
      const my = (e.clientY - rect.top) / rect.height
      el.style.setProperty('--pry', `${((mx - 0.5) * 10).toFixed(2)}deg`)
      el.style.setProperty('--prx', `${((0.5 - my) * 8).toFixed(2)}deg`)
      el.style.setProperty('--pmx', mx.toFixed(3))
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current.active) return
    drag.current.active = false
    if (committed.current) return
    const dist = Math.max(Math.abs(e.clientX - drag.current.x), Math.abs(e.clientY - drag.current.y))
    const dt = performance.now() - drag.current.t
    if (dist < 8 && dt < 400) {
      autoTear() // tap = auto-tear
    } else if (progress.get() >= 0.55) {
      commit()
    } else {
      // released early — the strip springs back closed
      animate(progress, 0, { type: 'spring', stiffness: 260, damping: 17 })
    }
  }

  return (
    <m.div
      className="pack-drop"
      animate={phase === 'burst' ? { y: 270, rotate: 7, opacity: 0 } : { y: 0, rotate: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeIn' }}
    >
      <div className={`pack-bob${reducedMotion ? ' no-bob' : ''}`}>
        <div
          className="pack"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <m.div
            className="pack-halo"
            style={{
              opacity: leakOpacity,
              scale: haloScale,
              background: `radial-gradient(circle, rgba(${leakRgb},.85) 0%, rgba(${leakRgb},.25) 45%, transparent 68%)`,
            }}
          />
          <img className="pack-img" src={PACK_URL} alt="" draggable={false} />
          <m.div
            className="pack-mouth"
            style={{
              opacity: leakOpacity,
              background: `radial-gradient(ellipse at 50% 108%, rgba(${leakRgb},.95) 0%, rgba(16,9,30,.97) 62%)`,
            }}
          />
          <m.div
            className="pack-stripfly"
            animate={phase === 'burst' ? { y: -230, x: -60, rotate: -28, opacity: 0 } : { y: 0, x: 0, rotate: 0, opacity: 1 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <m.div className="pack-strip" style={{ y: stripY, rotate: stripRotate, x: stripX }}>
              <img src={PACK_URL} alt="" draggable={false} />
            </m.div>
          </m.div>
          <div className="pack-glare" />
        </div>
      </div>
    </m.div>
  )
}
