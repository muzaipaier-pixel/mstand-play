// ─── App: stage machine for the pack-opening ritual (~5.5 s) ───────────────
// idle → (tap/drag tear, leak glows in the best card's colour) → burst
// (flash + confetti + foil shreds, pack body drops) → fan (5 cards face-down)
// → flips in ascending rarity, hero last with slow hang + rays + dim →
// summary (points credited, collection committed) → open another.
//
// The pack is ROLLED on first touch (so the leak colour is honest), CHARGED
// on tear commit, and COMMITTED to the save only when the summary lands —
// applyPackResult runs exactly once per pack.

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
import { Fan } from './components/Fan'
import { GachaCard } from './components/GachaCard'
import { Collection } from './components/Collection'

type Stage = 'idle' | 'burst' | 'fan' | 'summary'

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
  const [flippedCount, setFlippedCount] = useState(0)
  const [heroActive, setHeroActive] = useState(false)
  const [tearSignal, setTearSignal] = useState(0)
  const [burstKey, setBurstKey] = useState(0)
  const [showCollection, setShowCollection] = useState(false)

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
    setFlippedCount(0)
    setHeroActive(false)
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

  const heroFlip = (delay: number) => {
    later(() => {
      setFlippedCount(5)
      setHeroActive(true)
      if (resultRef.current) {
        sfx.revealStinger(resultRef.current.bestTier)
        const rgb = TIER_META[resultRef.current.bestTier].glow
        fireConfetti([rgb, ...PALETTE], TIER_META[resultRef.current.bestTier].rank >= 3)
      }
    }, delay)
    later(finishPack, delay + (reducedMotion ? 260 : 1350))
  }

  const scheduleFlips = () => {
    const step = reducedMotion ? 90 : 300
    for (let i = 0; i < 4; i++) {
      later(
        () => {
          setFlippedCount(i + 1)
          sfx.flipTick(i)
        },
        step * (i + 1),
      )
    }
    heroFlip(step * 4 + (reducedMotion ? 60 : 430))
  }

  /** Tear committed (tap / drag / button): charge, burst, fan, reveal. */
  const onCommitTear = () => {
    if (!resultRef.current) return
    creditPoints(-PACK_COST) // charge at commit; affordability was gated at prepare
    sfx.tearRip()
    setBurstKey((k) => k + 1)
    setStage('burst')
    fireConfetti([leak.glow, ...PALETTE])
    later(() => setStage('fan'), reducedMotion ? 90 : 430)
    later(scheduleFlips, reducedMotion ? 200 : 430 + 780)
  }

  const onOpenButton = () => {
    if (preparePack()) setTearSignal((s) => s + 1)
  }

  const skip = () => {
    if (stage === 'burst') {
      clearTimers()
      setStage('fan')
      setFlippedCount(4)
      heroFlip(90)
    } else if (stage === 'fan') {
      clearTimers()
      if (!heroActive && flippedCount < 5) {
        setFlippedCount(4)
        heroFlip(60)
      } else {
        finishPack()
      }
    }
  }

  const openAnother = () => {
    clearTimers()
    resultRef.current = null
    preparedRef.current = false
    setResult(null)
    setFlippedCount(0)
    setHeroActive(false)
    setStage('idle')
  }

  const epicRemaining = EPIC_PITY_DRY_PACKS + 1 - pity.packsSinceEpicPlus
  const legendaryRemaining = LEGENDARY_HARD - pity.packsSinceLegendary

  return (
    <LazyMotion features={domAnimation}>
      <div className={`app${reducedMotion ? ' reduced-motion' : ''}`}>
        <div className="bg-stars" aria-hidden />
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

        <div className="stage">
          {stage === 'burst' && <div className="flash" key={burstKey} style={{ ['--flash' as string]: leak.glow }} />}
          {stage === 'burst' && <Shreds rgb={leak.glowRgb} burstKey={burstKey} />}

          {(stage === 'idle' || stage === 'burst') && (
            <Pack
              leakColor={leak.glow}
              leakRgb={leak.glowRgb}
              phase={stage === 'burst' ? 'burst' : 'idle'}
              tearSignal={tearSignal}
              reducedMotion={reducedMotion}
              interactive={stage === 'idle' && (canAfford || preparedRef.current)}
              onFirstTouch={preparePack}
              onCommitTear={onCommitTear}
            />
          )}

          {(stage === 'fan' || stage === 'summary') && result && (
            <Fan
              pulls={result.pulls}
              flippedCount={stage === 'summary' ? 5 : flippedCount}
              heroActive={stage === 'summary' ? false : heroActive}
              reducedMotion={reducedMotion}
              tilt={!reducedMotion}
            />
          )}

          {(stage === 'burst' || stage === 'fan') && (
            <button className="btn btn-small skip-btn" onClick={skip}>
              {t.skip} ≫
            </button>
          )}
        </div>

        <div className="cta">
          {stage === 'idle' &&
            (canAfford ? (
              <>
                <button className="btn btn-primary" onClick={onOpenButton}>
                  {t.openPack}（{t.packCost}）
                </button>
                <p className="hint">{t.tapHint}</p>
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
