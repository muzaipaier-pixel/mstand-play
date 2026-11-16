// ─── GachaCard: vendored pokemon-cards-css card + ported interaction JS ────
// The foil/holo treatment is the REAL pokemon-cards-css by simeydotme
// (GPL-3.0, vendored under src/vendor/pokemon-cards-css/ — see
// THIRD-PARTY-NOTICES.md). This component reproduces the upstream Card.svelte
// DOM (.card > .card__translater > .card__rotator > .card__back/.card__front
// with .card__shine + .card__glare) and ports its pointer/spring driver to
// React: the same Math helpers (round/clamp/adjust), the same interact()
// mappings, the same spring settings, and svelte/motion's spring integrator,
// writing the same CSS vars (--pointer-x, --rotate-x, --card-opacity, …).
//
// Face-down state: upstream shows the front by default and rotates the
// rotator by --rotate-x = springRotate + springRotateDelta. We park
// springRotateDelta.x at 180° while a card is face-down (the library's own
// .card__back is pre-rotated 180°, so it faces the guest), and spring it to
// 0° to flip. The hero flip pauses edge-on (~92°) before completing.

import { memo, useEffect, useMemo, useRef } from 'react'
import { TIER_META, type CardDef } from '../data/cards'

/* Math helpers — ported verbatim from upstream src/lib/helpers/Math.js */
const round = (value: number, precision = 3) => parseFloat(value.toFixed(precision))
const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max)
const adjust = (value: number, fromMin: number, fromMax: number, toMin: number, toMax: number) =>
  round(toMin + ((toMax - toMin) * (value - fromMin)) / (fromMax - fromMin))

/* Spring settings — identical values to upstream Card.svelte */
const INTERACT = { stiffness: 0.066, damping: 0.25 }
const POPOVER = { stiffness: 0.033, damping: 0.45 }
const SNAP = { stiffness: 0.01, damping: 0.06 }

interface SpringVal {
  value: number
  last: number
  target: number
  stiffness: number
  damping: number
}
const springVal = (v: number, s: number, d: number): SpringVal => ({
  value: v,
  last: v,
  target: v,
  stiffness: s,
  damping: d,
})

/** One integration step of svelte/motion's spring (as used upstream). */
function tickSpring(s: SpringVal, dt: number): boolean {
  const delta = s.target - s.value
  const velocity = (s.value - s.last) / dt
  const force = s.stiffness * delta - s.damping * velocity
  const d = (velocity + force) * dt
  s.last = s.value
  if (Math.abs(d) < 0.01 && Math.abs(delta) < 0.01) {
    s.value = s.target
    s.last = s.target
    return false
  }
  s.value += d
  return true
}

interface Springs {
  rotateX: SpringVal
  rotateY: SpringVal
  glareX: SpringVal
  glareY: SpringVal
  glareO: SpringVal
  bgX: SpringVal
  bgY: SpringVal
  deltaX: SpringVal
  deltaY: SpringVal
  scale: SpringVal
}

interface Props {
  card: CardDef
  flipped: boolean
  isNew?: boolean
  dupPoints?: number
  /** hero = the pack's best card: flip pauses edge-on, then rays + scale-up (Fan) */
  hero?: boolean
  heroActive?: boolean
  /** face-down rarity tell: tier-coloured edge glow on the card back */
  tellGlow?: boolean
  /** enable pointer tilt (post-flip only) */
  tilt?: boolean
  reducedMotion?: boolean
  small?: boolean
}

export const GachaCard = memo(function GachaCard({
  card,
  flipped,
  isNew = false,
  dupPoints = 0,
  hero = false,
  heroActive = false,
  tellGlow = false,
  tilt = false,
  reducedMotion = false,
  small = false,
}: Props) {
  const meta = TIER_META[card.tier]
  const rootRef = useRef<HTMLDivElement>(null)
  const endTimer = useRef<number | undefined>(undefined)
  const heroTimer = useRef<number | undefined>(undefined)
  const flashTimer = useRef<number | undefined>(undefined)

  const springs = useRef<Springs | null>(null)
  if (springs.current === null) {
    springs.current = {
      rotateX: springVal(0, INTERACT.stiffness, INTERACT.damping),
      rotateY: springVal(0, INTERACT.stiffness, INTERACT.damping),
      glareX: springVal(50, INTERACT.stiffness, INTERACT.damping),
      glareY: springVal(50, INTERACT.stiffness, INTERACT.damping),
      glareO: springVal(0, INTERACT.stiffness, INTERACT.damping),
      bgX: springVal(50, INTERACT.stiffness, INTERACT.damping),
      bgY: springVal(50, INTERACT.stiffness, INTERACT.damping),
      deltaX: springVal(flipped ? 0 : 180, POPOVER.stiffness, POPOVER.damping),
      deltaY: springVal(0, POPOVER.stiffness, POPOVER.damping),
      scale: springVal(1, POPOVER.stiffness, POPOVER.damping),
    }
  }

  const rafId = useRef<number | null>(null)
  const lastTime = useRef(0)

  const writeVars = () => {
    const el = rootRef.current
    const sp = springs.current
    if (!el || !sp) return
    const gx = sp.glareX.value
    const gy = sp.glareY.value
    const fromCenter = clamp(Math.sqrt((gy - 50) * (gy - 50) + (gx - 50) * (gx - 50)) / 50, 0, 1)
    const st = el.style
    st.setProperty('--pointer-x', `${gx}%`)
    st.setProperty('--pointer-y', `${gy}%`)
    st.setProperty('--pointer-from-center', `${fromCenter}`)
    st.setProperty('--pointer-from-top', `${gy / 100}`)
    st.setProperty('--pointer-from-left', `${gx / 100}`)
    st.setProperty('--card-opacity', `${sp.glareO.value}`)
    st.setProperty('--rotate-x', `${sp.rotateX.value + sp.deltaX.value}deg`)
    st.setProperty('--rotate-y', `${sp.rotateY.value + sp.deltaY.value}deg`)
    st.setProperty('--background-x', `${sp.bgX.value}%`)
    st.setProperty('--background-y', `${sp.bgY.value}%`)
    st.setProperty('--card-scale', `${sp.scale.value}`)
    st.setProperty('--translate-x', '0px')
    st.setProperty('--translate-y', '0px')
  }

  const loop = (now: number) => {
    rafId.current = null
    const sp = springs.current
    if (!sp) return
    const dt = Math.min(Math.max((now - lastTime.current) / 1000, 1 / 240), 1 / 20)
    lastTime.current = now
    let alive = false
    for (const key of Object.keys(sp) as (keyof Springs)[]) {
      alive = tickSpring(sp[key], dt) || alive
    }
    writeVars()
    if (alive) wake()
  }

  const wake = () => {
    if (rafId.current === null) {
      lastTime.current = performance.now()
      rafId.current = requestAnimationFrame(loop)
    }
  }

  const setTargets = (
    settings: { stiffness: number; damping: number },
    targets: Partial<Record<keyof Springs, number>>,
  ) => {
    const sp = springs.current
    if (!sp) return
    for (const [key, value] of Object.entries(targets) as [keyof Springs, number][]) {
      sp[key].stiffness = settings.stiffness
      sp[key].damping = settings.damping
      sp[key].target = value
    }
    wake()
  }

  /* ── pointer interaction (ported from upstream interact/interactEnd) ── */
  const interact = (e: React.PointerEvent) => {
    if (!tilt || !flipped) return
    window.clearTimeout(endTimer.current)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const percent = {
      x: clamp(round((100 / rect.width) * (e.clientX - rect.left))),
      y: clamp(round((100 / rect.height) * (e.clientY - rect.top))),
    }
    const center = { x: percent.x - 50, y: percent.y - 50 }
    setTargets(INTERACT, {
      bgX: adjust(percent.x, 0, 100, 37, 63),
      bgY: adjust(percent.y, 0, 100, 33, 67),
      rotateX: round(-(center.x / 3.5)),
      rotateY: round(center.y / 3.5),
      glareX: round(percent.x),
      glareY: round(percent.y),
      glareO: 1,
    })
  }

  const interactEnd = () => {
    if (!tilt) return
    window.clearTimeout(endTimer.current)
    endTimer.current = window.setTimeout(() => {
      setTargets(SNAP, { rotateX: 0, rotateY: 0, glareX: 50, glareY: 50, glareO: 0, bgX: 50, bgY: 50 })
    }, 500)
  }

  /* ── flip: park rotateDelta.x at 180° face-down, spring to 0° ── */
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      writeVars()
      return
    }
    const sp = springs.current
    if (!sp) return
    window.clearTimeout(heroTimer.current)
    window.clearTimeout(flashTimer.current)
    if (flipped) {
      if (reducedMotion) {
        sp.deltaX.value = 0
        sp.deltaX.last = 0
        sp.deltaX.target = 0
        writeVars()
        return
      }
      // foil flash so the reveal reads even before the guest touches the card
      setTargets(POPOVER, { deltaX: hero ? 92 : 0, glareX: 35, glareY: 30, glareO: hero ? 0.9 : 0.55 })
      if (hero) {
        heroTimer.current = window.setTimeout(() => setTargets(POPOVER, { deltaX: 0 }), 430)
      }
      flashTimer.current = window.setTimeout(
        () => setTargets(SNAP, { glareX: 50, glareY: 50, glareO: 0 }),
        hero ? 1150 : 600,
      )
    } else {
      setTargets(POPOVER, { deltaX: 180 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped])

  useEffect(
    () => () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current)
      window.clearTimeout(endTimer.current)
      window.clearTimeout(heroTimer.current)
      window.clearTimeout(flashTimer.current)
    },
    [],
  )

  /* per-card random foil seed (upstream staticStyles) */
  const seedStyle = useMemo(() => {
    const sx = Math.random()
    const sy = Math.random()
    return {
      '--seedx': sx,
      '--seedy': sy,
      '--cosmosbg': `${Math.floor(sx * 734)}px ${Math.floor(sy * 1280)}px`,
    } as React.CSSProperties
  }, [])

  return (
    <div className={`gcard${small ? ' gcard--small' : ''}`}>
      {hero && (
        <div
          className={`gcard-rays${heroActive ? ' on' : ''}`}
          style={{
            background: `repeating-conic-gradient(from 0deg, rgba(${meta.glowRgb},.5) 0deg 7deg, transparent 7deg 22deg)`,
          }}
        />
      )}
      <div
        className="card interactive"
        data-rarity={meta.dataRarity}
        data-subtypes="basic"
        data-supertype="drink"
        ref={rootRef}
      >
        <div className="card__translater">
          <div className="card__rotator" onPointerMove={interact} onPointerLeave={interactEnd}>
            <div
              className="card__back"
              style={
                tellGlow
                  ? { boxShadow: `0 0 18px 2px rgba(${meta.glowRgb},.55), inset 0 0 0 2px rgba(${meta.glowRgb},.8)` }
                  : undefined
              }
            >
              <div className="back-m">M</div>
              <div className="back-star">★</div>
              <div className="back-sub">M STAND</div>
            </div>
            <div className="card__front" style={seedStyle}>
              <img src={card.art} alt={card.name} draggable={false} />
              <div className="card__shine" />
              <div className="card__glare" />
            </div>
          </div>
        </div>
      </div>
      {flipped && isNew && <div className="new-badge">NEW!</div>}
      {flipped && dupPoints > 0 && <div className="pt-floater">+{dupPoints} pt</div>}
    </div>
  )
})
