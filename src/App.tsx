// ─── App: stage machine for the pack-opening ritual ────────────────────────
// Pocket-style flow (rebuilt 2026-11-16, research: pokemon-pack-opening
// report §5.1): idle = pack CAROUSEL (pick one of five) → pack stage (drag
// across the top crimp to tear; light leaks the best card's colour) → burst
// (flash + confetti + foil shreds, pack body drops) → reveal = a stack the
// player flips through ONE card at a time, rarest last, legendary by
// press-and-hold → summary (points credited, collection committed).
//
// The pack is ROLLED when it is picked (so the leak colour is honest),
// CHARGED on tear commit, and COMMITTED to the save only when the summary
// lands — applyPackResult runs exactly once per pack.

import { useEffect, useMemo, useRef, useState } from 'react'
import { LazyMotion, domAnimation, AnimatePresence, m } from 'motion/react'
import confetti from 'canvas-confetti'
import { CARD_BY_ID, TIER_META, TIER_ORDER, type Tier } from './data/cards'
import { EPIC_PITY_DRY_PACKS, LEGENDARY_HARD, SLOT_WEIGHTS } from './data/odds'
import { rollPack, type PackResult } from './game/rollPack'
import { useGameStore, PACK_COST } from './store/useGameStore'
import { STRINGS } from './i18n'
import * as sfx from './audio/sfx'
import { Pack } from './components/Pack'
import { StackReveal } from './components/StackReveal'
import { Fan } from './components/Fan'
import { GachaCard } from './components/GachaCard'
import { Collection } from './components/Collection'

type Stage = 'idle' | 'pack' | 'burst' | 'reveal' | 'summary'

const PACK_URL = `${import.meta.env.BASE_URL}pack-cut.webp`

const PALETTE = ['#ff7aa2', '#ffd166', '#3cb89a', '#6ebbe3', '#b9a0ff', '#ffffff']

function fireConfetti(colors: string[], big = false) {
  const base = { colors, disableForReducedMotion: true, zIndex: 300, ticks: 190 }
  confetti({ ...base, particleCount: big ? 110 : 80, spread: 78, origin: { y: 0.42 }, scalar: big ? 1.05 : 0.92 })
  confetti({ ...base, particleCount: 34, angle: 60, spread: 58, origin: { x: 0, y: 0.62 } })
  confetti({ ...base, particleCount: 34, angle: 120, spread: 58, origin: { x: 1, y: 0.62 } })
}

/** Foil shreds shed at the tear — two-sided flakes that flutter down. */
function Shreds({ rgb, burstKey }: { rgb: string; burstKey: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 300,
        y: 60 + Math.random() * 200,
        r: Math.random() * 560 - 280,
        w: 7 + Math.random() * 8,
        h: 10 + Math.random() * 12,
        d: 0.85 + Math.random() * 0.5,
        bg:
          i % 3 === 0
            ? 'linear-gradient(135deg,#f4f4f8,#b9b9c9)'
            : i % 3 === 1
              ? `rgba(${rgb},.9)`
              : 'linear-gradient(135deg,#ffe9a8,#e8b84b)',
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burstKey],
  )
  return (
    <div className="shreds" aria-hidden>
      {pieces.map((p) => (
        <m.span
          key={p.id}
          className="shred"
          style={{ width: p.w, height: p.h, background: p.bg }}
          initial={{ x: 0, y: -60, rotate: 0, opacity: 1 }}
          animate={{ x: p.x, y: p.y, rotate: p.r, opacity: 0 }}
          transition={{ duration: p.d, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

export default function App() {
  const points = useGameStore((s) => s.wallet.points)
  const muted = useGameStore((s) => s.settings.muted)
  const lang = useGameStore((s) => s.settings.lang)
  const pity = useGameStore((s) => s.gacha.pity)
  const setMuted = useGameStore((s) => s.setMuted)
  const setLang = useGameStore((s) => s.setLang)
  const creditPoints = useGameStore((s) => s.creditPoints)
  const applyPackResult = useGameStore((s) => s.applyPackResult)
  const recharge = useGameStore((s) => s.recharge)
  const t = STRINGS[lang]

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const [stage, setStage] = useState<Stage>('idle')
  const [result, setResult] = useState<PackResult | null>(null)
  const [tearSignal, setTearSignal] = useState(0)
  const [burstKey, setBurstKey] = useState(0)
  const [showCollection, setShowCollection] = useState(false)
  const [selIdx, setSelIdx] = useState(2)
  const carDrag = useRef<{ x: number; moved: boolean }>({ x: 0, moved: false })

  const timers = useRef<number[]>([])
  const resultRef = useRef<PackResult | null>(null)
  const preparedRef = useRef(false)
  const appliedRef = useRef(false)

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }
  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  const bestTier: Tier = result?.bestTier ?? 'common'
  const leak = TIER_META[bestTier]
  const canAfford = points >= PACK_COST

  /** Roll the pack (no charge yet) so the tear can leak the honest colour. */
  const preparePack = (): boolean => {
    if (preparedRef.current) return true
    if (stage !== 'idle') return false
    const state = useGameStore.getState()
    if (state.wallet.points < PACK_COST) return false
    const rolled = rollPack(state.gacha.collection, state.gacha.pity)
    resultRef.current = rolled
    appliedRef.current = false
    preparedRef.current = true
    setResult(rolled)
    // Preload the 5 faces during the tear — foil arriving late reads broken.
    rolled.pulls.forEach((p) => {
      const img = new Image()
      img.src = CARD_BY_ID[p.cardId].art
    })
    return true
  }

  const finishPack = () => {
    if (resultRef.current && !appliedRef.current) {
      appliedRef.current = true
      applyPackResult(resultRef.current)
      if (resultRef.current.totalDupPoints > 0) sfx.coinChime()
    }
    setStage('summary')
  }

  /** Epic/Legendary flip landed in the stack reveal — celebrate it. */
  const handleBigReveal = (tier: Tier) => {
    const glow = TIER_META[tier].glow
    fireConfetti([glow, ...PALETTE], tier === 'legendary')
  }

  /** Carousel pick: roll the pack, then move to the tear stage. */
  const selectPack = (i: number) => {
    setSelIdx(i)
    if (preparePack()) setStage('pack')
  }

  /** Tear committed (drag / tap / button): charge, burst, then the stack. */
  const onCommitTear = () => {
    if (!resultRef.current) return
    creditPoints(-PACK_COST) // charge at commit; affordability was gated at prepare
    sfx.tearRip()
    setBurstKey((k) => k + 1)
    setStage('burst')
    fireConfetti([leak.glow, ...PALETTE])
    later(() => setStage('reveal'), reducedMotion ? 90 : 460)
  }

  const onOpenButton = () => {
    if (preparePack()) setTearSignal((s) => s + 1)
  }

  const skip = () => {
    if (stage === 'burst') {
      clearTimers()
      setStage('reveal')
    } else if (stage === 'reveal') {
      finishPack()
    }
  }

  const openAnother = () => {
    clearTimers()
    resultRef.current = null
    preparedRef.current = false
    setResult(null)
    setStage('idle')
  }

  const epicRemaining = EPIC_PITY_DRY_PACKS + 1 - pity.packsSinceEpicPlus
  const legendaryRemaining = LEGENDARY_HARD - pity.packsSinceLegendary

  return (
    <LazyMotion features={domAnimation}>
      <div className={`app${reducedMotion ? ' reduced-motion' : ''}`}>
        <header className="topbar">
          <div className="logo">
            M STAND
            <small>
              {t.title} · {t.subtitle}
            </small>
          </div>
          <div className="wallet-chip">
            {points} {t.pointsUnit}
          </div>
          <button
            className="iconbtn"
            onClick={() => setMuted(!muted)}
            title={muted ? t.soundOff : t.soundOn}
            aria-label={muted ? t.soundOff : t.soundOn}
          >
            {muted ? '×' : '♪'}
          </button>
          <button className="iconbtn" onClick={() => setLang(lang === 'ja' ? 'zh' : 'ja')} aria-label="language">
            {lang === 'ja' ? '中' : 'あ'}
          </button>
        </header>

        <div className={`stage${stage === 'reveal' ? ' stage-tall' : ''}`}>
          {stage === 'burst' && <div className="flash" key={burstKey} style={{ ['--flash' as string]: leak.glow }} />}
          {stage === 'burst' && <Shreds rgb={leak.glowRgb} burstKey={burstKey} />}

          {stage === 'idle' && (
            <div
              className="carousel"
              onPointerDown={(e) => {
                carDrag.current = { x: e.clientX, moved: false }
              }}
              onPointerMove={(e) => {
                if (carDrag.current.x && Math.abs(e.clientX - carDrag.current.x) > 12) carDrag.current.moved = true
              }}
              onPointerUp={(e) => {
                const dx = e.clientX - carDrag.current.x
                if (carDrag.current.moved) {
                  if (dx < -45) setSelIdx((i) => Math.min(i + 1, 4))
                  else if (dx > 45) setSelIdx((i) => Math.max(i - 1, 0))
                }
                carDrag.current.x = 0
              }}
            >
              {[0, 1, 2, 3, 4].map((i) => {
                const o = i - selIdx
                return (
                  <m.div
                    key={i}
                    className="car-pack"
                    animate={{
                      x: o * 118,
                      rotate: o * 7,
                      scale: 1 - Math.abs(o) * 0.14,
                      opacity: Math.abs(o) === 2 ? 0.5 : 1,
                    }}
                    transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                    style={{ zIndex: 10 - Math.abs(o) }}
                    onClick={() => {
                      if (carDrag.current.moved) return
                      if (i === selIdx) selectPack(i)
                      else setSelIdx(i)
                    }}
                  >
                    <img src={PACK_URL} alt="" draggable={false} />
                  </m.div>
                )
              })}
            </div>
          )}

          {(stage === 'pack' || stage === 'burst') && (
            <Pack
              leakColor={leak.glow}
              leakRgb={leak.glowRgb}
              bigPack={leak.rank >= 3}
              phase={stage === 'burst' ? 'burst' : 'idle'}
              tearSignal={tearSignal}
              reducedMotion={reducedMotion}
              interactive={stage === 'pack' && (canAfford || preparedRef.current)}
              onFirstTouch={preparePack}
              onCommitTear={onCommitTear}
            />
          )}

          {stage === 'reveal' && result && (
            <StackReveal pulls={result.pulls} reducedMotion={reducedMotion} t={t} onBigReveal={handleBigReveal} onFinish={finishPack} />
          )}

          {stage === 'summary' && result && (
            <Fan pulls={result.pulls} flippedCount={5} heroActive={false} reducedMotion={reducedMotion} tilt={!reducedMotion} />
          )}

          {(stage === 'burst' || stage === 'reveal') && (
            <button className="btn btn-small skip-btn" onClick={skip}>
              {t.skip} ≫
            </button>
          )}
        </div>

        <div className="cta">
          {stage === 'idle' &&
            (canAfford ? (
              <>
                <button className="btn btn-primary" onClick={() => selectPack(selIdx)}>
                  {t.openPack}（{t.packCost}）
                </button>
                <p className="hint">{t.choosePack}</p>
              </>
            ) : (
              <>
                <p className="hint warn">{t.notEnough}</p>
                <button
                  className="btn btn-gold"
                  onClick={() => {
                    recharge()
                    sfx.coinChime()
                  }}
                >
                  {t.recharge}
                </button>
              </>
            ))}

          {stage === 'pack' && (
            <>
              <button className="btn btn-primary" onClick={onOpenButton}>
                {t.openPack}（{t.packCost}）
              </button>
              <p className="hint">{t.tapHint}</p>
            </>
          )}

          {stage === 'summary' && result && (
            <div className="summary">
              <div className="summary-line">
                <span className="gain">+{result.totalDupPoints} pt</span>
                <span>
                  {t.newCards}: {result.pulls.filter((p) => p.isNew).length} / 5
                </span>
              </div>
              <div className="summary-btns">
                {canAfford ? (
                  <button className="btn btn-primary" onClick={openAnother}>
                    {t.openAnother}（{t.packCost}）
                  </button>
                ) : (
                  <button
                    className="btn btn-gold"
                    onClick={() => {
                      recharge()
                      sfx.coinChime()
                    }}
                  >
                    {t.recharge}
                  </button>
                )}
                <button className="btn" onClick={() => setShowCollection(true)}>
                  {t.collection}
                </button>
              </div>
            </div>
          )}

          {stage !== 'summary' && stage !== 'idle' && <div className="cta-spacer" />}
          {stage === 'idle' && (
            <button className="btn btn-ghost" onClick={() => setShowCollection(true)}>
              {t.collection}
            </button>
          )}
        </div>

        <details className="odds">
          <summary>{t.oddsTitle}</summary>
          <p>{t.oddsNote}</p>
          <ul>
            {TIER_ORDER.slice(2).map((tier) => (
              <li key={tier}>
                <span style={{ color: TIER_META[tier].glow }}>●</span> {t.tierNames[tier]} —{' '}
                {tier === 'rare'
                  ? `${Math.round(SLOT_WEIGHTS.hit.rare * 100)}%`
                  : tier === 'epic'
                    ? `${Math.round(SLOT_WEIGHTS.hit.epic * 100)}%`
                    : `${Math.round(SLOT_WEIGHTS.hit.legendary * 100)}%`}
                <span className="odds-slot"> / 5枚目</span>
              </li>
            ))}
          </ul>
          <p className="odds-pity">
            {t.epicIn(epicRemaining)} · {t.legendaryIn(legendaryRemaining)}
          </p>
        </details>

        <p className="foot">M STAND play — drink cards</p>

        <AnimatePresence>
          {showCollection && (
            <div className="drawer-wrap">
              <Collection onClose={() => setShowCollection(false)} />
            </div>
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  )
}
