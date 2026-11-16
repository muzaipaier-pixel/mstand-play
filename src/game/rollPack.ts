// ─── rollPack: the gacha engine ─────────────────────────────────────────────
// Pure function — (collection, pity, rng) → the 5 cards of one pack.
// The result is decided BEFORE any animation runs (honesty rule: the only
// signal shown during the tear is the leak-glow, which always equals the
// best card actually in the pack).
//
// Cards come back sorted by tier ascending (rarest LAST = reveal order);
// within one tier, duplicates flip before first-time cards so a NEW card of
// the top tier is always the hero.

import { POOL_BY_TIER, TIER_META, type Tier } from '../data/cards'
import { SLOT_WEIGHTS, EPIC_PITY_DRY_PACKS, legendaryWeight } from '../data/odds'

export interface PityState {
  packsSinceEpicPlus: number
  packsSinceLegendary: number
}

export interface CollectionMap {
  [cardId: number]: { count: number; firstPulledAt: number } | undefined
}

export interface PullResult {
  cardId: number
  tier: Tier
  isNew: boolean
  /** points this pull converts to (0 for first-time cards — the card is the reward) */
  dupPoints: number
}

export interface PackResult {
  /** 5 pulls, rarest last */
  pulls: PullResult[]
  totalDupPoints: number
  bestTier: Tier
  newPity: PityState
  /** true when the Epic pity guarantee fired for this pack */
  epicPityTriggered: boolean
}

function pickFromTier(tier: Tier, rng: () => number): number {
  const pool = POOL_BY_TIER[tier]
  return pool[Math.floor(rng() * pool.length)]
}

/** Roll the tier for one slot. Slot index is 0-based (slot 5 = index 4). */
function rollSlotTier(slot: number, pity: PityState, rng: () => number): Tier {
  const r = rng()
  if (slot <= 2) {
    return r < SLOT_WEIGHTS.early.common ? 'common' : 'uncommon'
  }
  if (slot === 3) {
    return r < SLOT_WEIGHTS.mid.uncommon ? 'uncommon' : 'rare'
  }
  // Hit slot. Epic pity: a long drought forces Epic+.
  const legW = legendaryWeight(pity.packsSinceLegendary)
  if (pity.packsSinceEpicPlus >= EPIC_PITY_DRY_PACKS) {
    return r < Math.max(0.15, legW) ? 'legendary' : 'epic'
  }
  if (r < legW) return 'legendary'
  if (r < legW + SLOT_WEIGHTS.hit.epic) return 'epic'
  return 'rare'
}

export function rollPack(
  collection: CollectionMap,
  pity: PityState,
  rng: () => number = Math.random,
): PackResult {
  // Working copy of owned counts — a card pulled twice in the same pack
  // counts as owned for the second pull (so it converts to points).
  const counts = new Map<number, number>()
  for (const [id, entry] of Object.entries(collection)) {
    if (entry) counts.set(Number(id), entry.count)
  }

  const pulls: PullResult[] = []
  for (let slot = 0; slot < 5; slot++) {
    const tier = rollSlotTier(slot, pity, rng)
    const cardId = pickFromTier(tier, rng)
    const owned = counts.get(cardId) ?? 0
    const isNew = owned === 0
    pulls.push({
      cardId,
      tier,
      isNew,
      dupPoints: isNew ? 0 : TIER_META[tier].dupPoints,
    })
    counts.set(cardId, owned + 1)
  }

  // Reveal order: weakest → strongest; duplicates before NEW within a tier.
  pulls.sort((a, b) => {
    const d = TIER_META[a.tier].rank - TIER_META[b.tier].rank
    if (d !== 0) return d
    return Number(a.isNew) - Number(b.isNew)
  })

  const bestTier = pulls[pulls.length - 1].tier
  const gotEpicPlus = pulls.some((p) => TIER_META[p.tier].rank >= TIER_META.epic.rank)
  const gotLegendary = pulls.some((p) => p.tier === 'legendary')

  return {
    pulls,
    totalDupPoints: pulls.reduce((sum, p) => sum + p.dupPoints, 0),
    bestTier,
    newPity: {
      packsSinceEpicPlus: gotEpicPlus ? 0 : pity.packsSinceEpicPlus + 1,
      packsSinceLegendary: gotLegendary ? 0 : pity.packsSinceLegendary + 1,
    },
    epicPityTriggered: pity.packsSinceEpicPlus >= EPIC_PITY_DRY_PACKS,
  }
}
