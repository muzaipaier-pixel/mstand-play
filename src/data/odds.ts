// ─── Odds & pity tuning (research report §3, café-scale model) ──────────────
// Slot-based pack construction (NOT 5 identical rolls):
//   slots 1–3 : 75% Common / 25% Uncommon
//   slot 4    : 70% Uncommon / 30% Rare
//   slot 5    : the "hit slot" — Rare / Epic / Legendary (weights below)
// ⇒ every pack guarantees at least one Rare-or-better card.
//
// Pity (persisted in the save, see store):
//   • Epic pity — after 9 consecutive packs with no Epic+, slot 5 of the next
//     pack is guaranteed Epic+ (85% Epic / 15% Legendary, or the Legendary
//     soft-pity weight if that is higher).
//   • Legendary soft/hard pity — the Legendary weight in slot 5 grows linearly
//     from pack 15 of a drought and reaches 100% at pack 25, so the full
//     27-card set is always completable in ≤ 25 packs.

export const SLOT_WEIGHTS = {
  /** slots 1–3 */
  early: { common: 0.75, uncommon: 0.25 },
  /** slot 4 */
  mid: { uncommon: 0.7, rare: 0.3 },
  /** slot 5 base weights (legendary weight is pity-adjusted at roll time) */
  hit: { rare: 0.82, epic: 0.15, legendary: 0.03 },
} as const

export const EPIC_PITY_DRY_PACKS = 9
export const LEGENDARY_SOFT_START = 15
export const LEGENDARY_HARD = 25

/** Legendary probability for the hit slot, given the current drought length. */
export function legendaryWeight(packsSinceLegendary: number): number {
  const n = packsSinceLegendary + 1 // this pack is the n-th of the drought
  if (n >= LEGENDARY_HARD) return 1
  if (n <= LEGENDARY_SOFT_START) return SLOT_WEIGHTS.hit.legendary
  const t = (n - LEGENDARY_SOFT_START) / (LEGENDARY_HARD - LEGENDARY_SOFT_START)
  return SLOT_WEIGHTS.hit.legendary + t * (1 - SLOT_WEIGHTS.hit.legendary)
}
