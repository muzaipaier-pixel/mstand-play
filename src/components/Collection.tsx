// ─── Collection drawer: the binder, grouped by set (54 cards) ──────────────
// Owned cards show in colour with a ×count badge; missing cards are quiet
// sunken grooves in the card's own shape — no numbers, no dashed frames
// (Pocket's binder rule). Static mini faces (no tilt) — the full holo
// treatment is reserved for the focused reveal, per the research rules.
// Each slot follows its own set's native art ratio (Set 1 0.714, Set 2 0.483).

import { m } from 'motion/react'
import { CARDS } from '../data/cards'
import { useGameStore } from '../store/useGameStore'
import { STRINGS } from '../i18n'

export function Collection({ onClose }: { onClose: () => void }) {
  const collection = useGameStore((s) => s.gacha.collection)
  const stats = useGameStore((s) => s.gacha.stats)
  const lang = useGameStore((s) => s.settings.lang)
  const t = STRINGS[lang]
  const owned = CARDS.filter((c) => collection[c.id]).length

  return (
    <m.div
      className="drawer"
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <div className="drawer-head">
        <h2>
          {t.collection} — {t.owned} {owned} / {CARDS.length}
        </h2>
        <button className="btn btn-small" onClick={onClose}>
          {t.close}
        </button>
      </div>
      <p className="drawer-sub">
        {t.packsOpened}: {stats.packsOpened}
      </p>
      {[
        { label: 'SET 1 · GENESIS', cards: CARDS.filter((c) => c.id <= 27) },
        { label: 'SET 2 · COSMOS', cards: CARDS.filter((c) => c.id > 27) },
      ].map((group) => (
        <div key={group.label}>
          <div className="binder-set">{group.label}</div>
          <div className="binder">
            {group.cards.map((card) => {
              const entry = collection[card.id]
              return entry ? (
                <div
                  key={card.id}
                  className="slot owned"
                  title={card.name}
                  style={{ aspectRatio: card.ratio }}
                >
                  <img src={card.art} alt={card.name} loading="lazy" draggable={false} />
                  <span className="slot-stars">{'★'.repeat(card.stars)}</span>
                  {entry.count > 1 && <span className="slot-count">×{entry.count}</span>}
                </div>
              ) : (
                <div
                  key={card.id}
                  className="slot missing"
                  title={card.name}
                  style={{ aspectRatio: card.ratio }}
                />
              )
            })}
          </div>
        </div>
      ))}
    </m.div>
  )
}
