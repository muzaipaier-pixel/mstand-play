// ─── Pack: foil pack with a Pocket-style horizontal zigzag tear ────────────
// Rebuilt 2026-11-16 to the Pokémon TCG Pocket ritual (research:
// ~/workspace/research_notes/pokemon-pack-opening/report.md §5.2):
//   • Drag ACROSS the top crimp — progress follows the pointer's x through a
//     stiff spring (slight lag = foil weight) and is a pure function of the
//     pointer, so dragging back MENDS the pack; releasing early springs it
//     shut. Only crossing the far end (progress ≥ ~0.97) commits the tear.
//   • The torn edge is a seeded zigzag: the pack body is clipped below it,
//     the still-attached strip above-right of the tear front, and the peeled
//     strip above-left of it (curling away with a silver back face). The cut
//     exists only behind the front — ahead of it the strip is whole.
//   • Light leaks from the cut in the colour of the best card inside (rolled
//     before the gesture starts — honest foreshadowing), growing with the
//     tear; packs hiding an Epic+ card tremble while being torn.
//   • Tap (or the Open button) runs an auto-tear along the same model.

import { useEffect, useMemo, useRef, useState } from 'react'
import { m, useMotionValue, useSpring, useTransform, animate } from 'motion/react'
import { tearCrinkle } from '../audio/sfx'

const PACK_URL = `${import.meta.env.BASE_URL}pack-cut.webp`
const STRIP = 26 // tear line height, % of pack height
const SEGS = 24

/** Seeded zigzag teeth (y in %) along the tear line — same path every render. */
const TEETH: number[] = (() => {
  let seed = 20261116
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  return Array.from({ length: SEGS + 1 }, (_, i) =>
    i === 0 || i === SEGS ? STRIP : STRIP + (rnd() - 0.5) * 2.4,
  )
})()
const toothAt = (fx: number) => {
  const pos = Math.min(Math.max(fx, 0), 1) * SEGS
  const i = Math.min(Math.floor(pos), SEGS - 1)
  const frac = pos - i
  return TEETH[i] + (TEETH[i + 1] - TEETH[i]) * frac
}
const teethRange = (from: number, to: number, step: number) => {
  const pts: string[] = []
  for (let i = from; step > 0 ? i <= to : i >= to; i += step) {
    pts.push(`${((i / SEGS) * 100).toFixed(2)}% ${TEETH[i].toFixed(2)}%`)
  }
  return pts
}

interface PackProps {
  /** aura colour of the best card in the prepared pack */
  leakColor: string
  leakRgb: string
  /** tremble while tearing when the pack hides an Epic+ card */
  bigPack: boolean
  phase: 'idle' | 'burst'
  /** increment to trigger a programmatic (button) auto-tear */
  tearSignal: number
  reducedMotion: boolean
  interactive: boolean
  onFirstTouch: () => void
  onCommitTear: () => void
}

export function Pack({
  leakRgb,
  bigPack,
  phase,
  tearSignal,
  reducedMotion,
  interactive,
  onFirstTouch,
  onCommitTear,
}: PackProps) {
  const raw = useMotionValue(0)
  const progress = useSpring(raw, { stiffness: 320, damping: 27, mass: 0.6 })
  const [tearing, setTearing] = useState(false)

  const bodyClip = useMemo(
    () => `polygon(0% ${TEETH[0]}%, ${teethRange(1, SEGS, 1).join(', ')}, 100% 100%, 0% 100%)`,
    [],
  )
  const intactClip = useTransform(progress, (v) => {
    const fx = Math.min(Math.max(v, 0), 1)
    const startSeg = Math.ceil(fx * SEGS)
    const pts = [`${(fx * 100).toFixed(2)}% 0%`, '100% 0%', `100% ${TEETH[SEGS]}%`]
    pts.push(...teethRange(SEGS - 1, startSeg, -1))
    pts.push(`${(fx * 100).toFixed(2)}% ${toothAt(fx).toFixed(2)}%`)
    return `polygon(${pts.join(', ')})`
  })
  const peeledClip = useTransform(progress, (v) => {
    const fx = Math.min(Math.max(v, 0), 1)
    const endSeg = Math.floor(fx * SEGS)
    const pts = ['0% 0%', `${(fx * 100).toFixed(2)}% 0%`, `${(fx * 100).toFixed(2)}% ${toothAt(fx).toFixed(2)}%`]
    pts.push(...teethRange(endSeg, 0, -1))
    return `polygon(${pts.join(', ')})`
  })
  const peeledX = useTransform(progress, [0, 1], [0, -36])
  const peeledRotate = useTransform(progress, [0, 1], [0, -16])
  const peeledSkew = useTransform(progress, [0, 1], [0, -7])
  const peeledOrigin = useTransform(progress, (v) => `${(v * 100).toFixed(1)}% 100%`)
  const silverOpacity = useTransform(progress, [0, 1], [0, 0.55])
  const leakOpacity = useTransform(progress, [0.03, 0.55], [0, 1])
  const leakWidth = useTransform(progress, (v) => `${Math.max(v * 100, 0).toFixed(1)}%`)

  const drag = useRef<{ x: number; t: number; active: boolean; lastCrinkle: number; width: number }>({
    x: 0,
    t: 0,
    active: false,
    lastCrinkle: 0,
    width: 1,
  })
  const committed = useRef(false)
  const prepared = useRef(false)

  const commit = () => {
    if (committed.current) return
    committed.current = true
    setTearing(false)
    animate(raw, 1, { duration: reducedMotion ? 0.05 : 0.16, ease: 'easeOut' })
    onCommitTear()
  }

  const autoTear = () => {
    if (committed.current || !interactive) return
    if (!prepared.current) {
      prepared.current = true
      onFirstTouch()
    }
    animate(raw, 1, {
      duration: reducedMotion ? 0.08 : 0.85,
      ease: [0.35, 0.6, 0.35, 1],
      onUpdate: (v) => {
        if (v > 0.2 && v < 0.95 && Math.random() < 0.35) tearCrinkle()
      },
      onComplete: commit,
    })
  }

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
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    drag.current = { x: e.clientX, t: performance.now(), active: true, lastCrinkle: 0, width: rect.width }
    setTearing(true)
    if (!prepared.current) {
      prepared.current = true
      onFirstTouch()
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement
    if (drag.current.active && !committed.current) {
      const p = Math.min(Math.max((e.clientX - drag.current.x) / (drag.current.width * 0.88), 0), 1)
      raw.set(p)
      if (Math.abs(p - drag.current.lastCrinkle) > 0.05) {
        drag.current.lastCrinkle = p
        tearCrinkle()
      }
      if (p >= 0.995) commit()
    } else if (!committed.current) {
      const rect = el.getBoundingClientRect()
      const mx = (e.clientX - rect.left) / rect.width
      const my = (e.clientY - rect.top) / rect.height
      el.style.setProperty('--pry', `${((mx - 0.5) * 10).toFixed(2)}deg`)
      el.style.setProperty('--prx', `${((0.5 - my) * 8).toFixed(2)}deg`)
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current.active) return
    drag.current.active = false
    setTearing(false)
    if (committed.current) return
    const moved = Math.abs(e.clientX - drag.current.x)
    const dt = performance.now() - drag.current.t
    if (moved < 8 && dt < 400) {
      autoTear()
    } else if (raw.get() >= 0.97) {
      commit()
    } else {
      // released early — the foil springs shut and the pack mends
      animate(raw, 0, { type: 'spring', stiffness: 240, damping: 19 })
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
          className={`pack${tearing && bigPack && !reducedMotion ? ' pack-shaking' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* body: everything below the zigzag */}
          <img className="pack-layer" src={PACK_URL} alt="" draggable={false} style={{ clipPath: bodyClip }} />
          {/* light leaking along the cut, as far as the tear has run */}
          <m.div
            className="pack-leak"
            style={{
              width: leakWidth,
              opacity: leakOpacity,
              background: `linear-gradient(180deg, transparent 0%, rgba(${leakRgb},.95) 52%, rgba(255,255,255,.95) 76%, transparent 100%)`,
            }}
          />
          <m.div
            className="pack-stripfly"
            animate={phase === 'burst' ? { y: -240, x: -70, rotate: -30, opacity: 0 } : { y: 0, x: 0, rotate: 0, opacity: 1 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            {/* still-attached strip (right of the tear front) */}
            <m.img className="pack-layer" src={PACK_URL} alt="" draggable={false} style={{ clipPath: intactClip }} />
            {/* peeled strip (left of the front), curling away, silver back */}
            <m.div
              className="pack-peel"
              style={{ x: peeledX, rotate: peeledRotate, skewY: peeledSkew, transformOrigin: peeledOrigin }}
            >
              <m.img className="pack-layer" src={PACK_URL} alt="" draggable={false} style={{ clipPath: peeledClip }} />
              <m.div className="pack-silver" style={{ opacity: silverOpacity, clipPath: peeledClip }} />
            </m.div>
          </m.div>
          <div className="pack-tearline" aria-hidden />
          <div className="pack-glare" />
        </div>
      </div>
    </m.div>
  )
}
