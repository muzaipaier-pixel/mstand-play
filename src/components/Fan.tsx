// ─── Fan: the 5 pulled cards fanned face-down, then flipped in place ───────
// Geometry (research §4.2): transform-origin 50% 130% (pivot below the card),
// rotations −28° / −14° / 0° / +14° / +28°. The pulls arrive sorted weakest →
// strongest; the hero (strongest, last pull) takes the CENTRE slot so the
// reveal order is: far-left, left, right, far-right, centre hero last.
// While face-down, Rare+ backs carry their tier's edge glow (the pre-flip
// tell). When the hero flips, it scales to 1.28× and lifts while the other
// cards dim.

import { m } from 'motion/react'
import { CARD_BY_ID, TIER_META } from '../data/cards'
import type { PullResult } from '../game/rollPack'
import { GachaCard } from './GachaCard'

/** Fan slot per pull index (pulls are sorted ascending; index 4 = hero). */
const SLOTS = [
  { rotate: -28, x: -97, y: 16 },
  { rotate: -14, x: -50, y: 5 },
  { rotate: 14, x: 50, y: 5 },
  { rotate: 28, x: 97, y: 16 },
  { rotate: 0, x: 0, y: -14 },
]

interface FanProps {
  pulls: PullResult[]
  flippedCount: number
  heroActive: boolean
  reducedMotion: boolean
  tilt: boolean
}

export function Fan({ pulls, flippedCount, heroActive, reducedMotion, tilt }: FanProps) {
  return (
    <div className="fan">
      {pulls.map((pull, i) => {
        const card = CARD_BY_ID[pull.cardId]
        const slot = SLOTS[i]
        const isHero = i === pulls.length - 1
        const flipped = i < flippedCount
        const entrance = reducedMotion
          ? { duration: 0.12 }
          : { type: 'spring' as const, stiffness: 210, damping: 21, delay: 0.06 * i }
        return (
          <m.div
            key={`${pull.cardId}-${i}`}
            className="fan-card"
            style={{ transformOrigin: '50% 130%', zIndex: isHero && heroActive ? 20 : i === 4 ? 5 : 3 - Math.abs(2 - i) }}
            initial={{ x: 0, y: 90, rotate: 0, scale: 0.5, opacity: 0 }}
            animate={
              isHero && heroActive
                ? { x: 0, y: -52, rotate: 0, scale: 1.28, opacity: 1 }
                : {
                    x: slot.x,
                    y: slot.y,
                    rotate: slot.rotate,
                    scale: 1,
                    opacity: 1,
                    filter: heroActive ? 'brightness(.5)' : 'brightness(1)',
                  }
            }
            transition={isHero && heroActive ? { type: 'spring', stiffness: 170, damping: 19 } : entrance}
          >
            <GachaCard
              card={card}
              flipped={flipped}
              isNew={pull.isNew}
              dupPoints={pull.dupPoints}
              hero={isHero}
              heroActive={heroActive && isHero}
              tellGlow={!flipped && TIER_META[pull.tier].rank >= 2}
              tilt={tilt}
              reducedMotion={reducedMotion}
            />
          </m.div>
        )
      })}
    </div>
  )
}
