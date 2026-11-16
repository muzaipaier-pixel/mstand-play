// ─── StackReveal: Pocket-style one-at-a-time card reveal ───────────────────
// Rebuilt 2026-11-16 (research report §5.3). The 5 pulls arrive as a stack,
// weakest first, best card LAST. Each card gets its own full-stage moment:
//   • common / uncommon — arrive face up; tap or swipe sends them to the tray.
//   • rare — arrives FACE DOWN with a tier-coloured edge tell; tap flips
//     (0.45 s class) with a flash + stinger.
//   • epic — face down, pulsing; tap flips slow with rays + confetti.
//   • legendary — face down, pulsing hard; PRESS & HOLD ~0.9 s to charge
//     (ring fills, riser climbs, the stack trembles), then the hero flip
//     (edge-on hang lives in GachaCard) with bloom + confetti.
// The last card always arrives face down, whatever its tier. A revealed hit
// never advances on the flip tap itself — advancing is a separate tap.

import { useEffect, useRef, useState } from 'react'
import { m, AnimatePresence } from 'motion/react'
import { CARD_BY_ID, TIER_META, type Tier } from '../data/cards'
import type { PullResult } from '../game/rollPack'
import type { Strings } from '../i18n'
import * as sfx from '../audio/sfx'
import { GachaCard } from './GachaCard'

const HOLD_MS = 900

interface Props {
  pulls: PullResult[]
  reducedMotion: boolean
  t: Strings
  /** epic/legendary flip landed — parent fires confetti */
  onBigReveal: (tier: Tier) => void
  onFinish: () => void
}

export function StackReveal({ pulls, reducedMotion, t, onBigReveal, onFinish }: Props) {
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [charge, setCharge] = useState(0)
  const [holding, setHolding] = useState(false)
  const [flashKey, setFlashKey] = useState(0)

  const holdRaf = useRef<number | undefined>(undefined)
  const downPos = useRef<{ x: number; y: number } | null>(null)
  const busy = useRef(false)

  const pull = pulls[idx]
  const card = CARD_BY_ID[pull.cardId]
  const meta = TIER_META[pull.tier]
  const isLast = idx === pulls.length - 1
  const faceDown = meta.rank >= 2 || isLast
  const needsHold = pull.tier === 'legendary' && !reducedMotion
  const shown = flipped || !faceDown

  useEffect(() => {
    setFlipped(false)
    setLeaving(false)
    setCharge(0)
    setHolding(false)
    busy.current = false
  }, [idx])

  useEffect(() => () => cancelHold(), [])

  const cancelHold = () => {
    if (holdRaf.current) cancelAnimationFrame(holdRaf.current)
    holdRaf.current = undefined
    setHolding(false)
    setCharge(0)
  }

  const doFlip = () => {
    if (flipped || busy.current) return
    busy.current = true
    setFlipped(true)
    setFlashKey((k) => k + 1)
    if (meta.rank >= 2) {
      sfx.revealStinger(pull.tier)
      if (meta.rank >= 3) onBigReveal(pull.tier)
    } else {
      sfx.flipTick(idx)
    }
    window.setTimeout(() => {
      busy.current = false
    }, 500)
  }

  const startHold = () => {
    if (flipped || !needsHold) return
    setHolding(true)
    sfx.chargeRiser()
    const t0 = performance.now()
    const step = (now: number) => {
      const c = Math.min((now - t0) / HOLD_MS, 1)
      setCharge(c)
      if (c >= 1) {
        holdRaf.current = undefined
        setHolding(false)
        doFlip()
        return
      }
      holdRaf.current = requestAnimationFrame(step)
    }
    holdRaf.current = requestAnimationFrame(step)
  }

  const advance = () => {
    if (leaving || busy.current) return
    setLeaving(true)
    sfx.whoosh()
    window.setTimeout(() => {
      if (isLast) onFinish()
      else setIdx(idx + 1)
    }, reducedMotion ? 60 : 320)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    downPos.current = { x: e.clientX, y: e.clientY }
    if (!shown && needsHold) startHold()
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const wasHolding = holding
    if (holding) cancelHold()
    const d = downPos.current
    downPos.current = null
    if (!d || wasHolding) return
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y)
    if (!shown) {
      if (!needsHold && moved < 12) doFlip()
    } else if (moved > 55 || moved < 12) {
      advance()
    }
  }
  const onPointerLeave = () => {
    if (holding) cancelHold()
  }

  const R = 30
  const CIRC = 2 * Math.PI * R

  return (
    <div className="stackreveal">
      <div className="sr-count">
        {idx + 1} / {pulls.length}
        {isLast ? ` · ${t.lastCard}` : ''}
      </div>

      <AnimatePresence mode="popLayout">
        <m.div
          key={idx}
          className={`sr-card${!shown && meta.rank >= 3 ? ' sr-pulse' : ''}`}
          style={{ ['--srgb' as string]: meta.glowRgb }}
          initial={{ y: 120, scale: 0.78, opacity: 0, rotate: 0 }}
          animate={
            leaving
              ? { x: 300, y: 30, rotate: 16, opacity: 0, scale: 0.9 }
              : holding
                ? { x: [0, -2.5, 2.5, -3.5, 3.5, 0], y: 0, rotate: 0, opacity: 1, scale: 1 }
                : { x: 0, y: 0, rotate: 0, opacity: 1, scale: flipped && isLast ? 1.06 : 1 }
          }
          transition={
            leaving
              ? { duration: 0.3, ease: 'easeIn' }
              : holding
                ? { duration: 0.26, repeat: Infinity }
                : { type: 'spring', stiffness: 210, damping: 21 }
          }
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onPointerCancel={onPointerLeave}
        >
          <GachaCard
            card={card}
            flipped={shown}
            isNew={pull.isNew}
            dupPoints={pull.dupPoints}
            hero={isLast}
            heroActive={flipped && isLast}
            tellGlow={!shown && meta.rank >= 2}
            tilt={shown && !reducedMotion}
            reducedMotion={reducedMotion}
          />
        </m.div>
      </AnimatePresence>

      {flashKey > 0 && meta.rank >= 2 && (
        <div className="flash" key={flashKey} style={{ ['--flash' as string]: meta.glow }} />
      )}

      <div className="sr-under">
        {!shown && needsHold && (
          <>
            <svg className="charge-ring" width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r={R * 0.62} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="4" />
              <circle
                cx="22"
                cy="22"
                r={R * 0.62}
                fill="none"
                stroke={meta.glow}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={CIRC * 0.62}
                strokeDashoffset={CIRC * 0.62 * (1 - charge)}
                transform="rotate(-90 22 22)"
              />
            </svg>
            <div className="sr-hint">{t.holdReveal}</div>
          </>
        )}
        {!shown && !needsHold && <div className="sr-hint">{t.tapReveal}</div>}
        {shown && <div className="sr-hint">{isLast ? t.tapReveal : t.nextHint}</div>}
      </div>

      <div className="sr-tray" aria-hidden>
        {pulls.slice(0, idx + (leaving ? 1 : 0)).map((p, j) => (
          <img key={j} src={CARD_BY_ID[p.cardId].art} alt="" />
        ))}
      </div>
    </div>
  )
}
