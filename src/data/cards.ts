// ─── Card master data: the 27 M Stand drinks ────────────────────────────────
// Printed stars (★) are the rarity shown on the physical-style card face and in
// the collection. The internal `tier` drives the gacha odds (see odds.ts).
//
// Tier mapping (report §3 split: Common×12 · Uncommon×8 · Rare×4 · Epic×2 ·
// Legendary×1 = 27). The four ★★★ signature drinks span the top three tiers:
//   Legendary (1): #19 Royal Boba — the shop's signature drink
//   Epic      (2): #1 Brown Sugar Boba, #14 Cheese Matcha
//   Rare      (4): #2 Mango Pomelo Sago (★★★) + #5/#15/#21 (★★ signatures)
//   Uncommon  (8): the remaining ★★ regulars
//   Common   (12): all eight ★ teas + four ★★ everyday smoothies/milks

export type Tier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface CardDef {
  id: number
  name: string
  stars: 1 | 2 | 3
  tier: Tier
  art: string
}

const art = (id: number) => `${import.meta.env.BASE_URL}cards/${String(id).padStart(2, '0')}.webp`
const art2 = (id: number) => `${import.meta.env.BASE_URL}cards2/${String(id).padStart(2, '0')}.webp`

const T = (
  id: number,
  name: string,
  stars: 1 | 2 | 3,
  tier: Tier,
): CardDef => ({ id, name, stars, tier, art: art(id) })

const SET1: CardDef[] = [
  T(1, 'Brown Sugar Boba', 3, 'epic'),
  T(2, 'Mango Pomelo Sago', 3, 'rare'),
  T(3, 'Cheese Foam 4Seasons', 2, 'uncommon'),
  T(4, 'Taro Milk Smoothie', 2, 'uncommon'),
  T(5, 'Matcha Milk', 2, 'rare'),
  T(6, 'Dragon Fruit Milk', 2, 'uncommon'),
  T(7, 'Blueberry Smoothie', 2, 'common'),
  T(8, 'Mix Berry Smoothie', 2, 'common'),
  T(9, 'Strawberry Milk', 2, 'uncommon'),
  T(10, 'Lime Burst Tea', 1, 'common'),
  T(11, 'Winter Melon Tea', 1, 'common'),
  T(12, 'Dragon Fruit Tea', 1, 'common'),
  T(13, 'Mango Milk', 2, 'uncommon'),
  T(14, 'Cheese Matcha', 3, 'epic'),
  T(15, 'Avocado Smoothie', 2, 'rare'),
  T(16, 'Strawberry Smoothie', 2, 'uncommon'),
  T(17, 'Passion Fruit Tea', 1, 'common'),
  T(18, 'Pineapple Smoothie', 2, 'common'),
  T(19, 'Royal Boba', 3, 'legendary'),
  T(20, 'Jasmine Tea', 1, 'common'),
  T(21, 'Coconut Smoothie', 2, 'rare'),
  T(22, 'Cheese Foam Jasmine', 2, 'uncommon'),
  T(23, 'Yuzu Honey Orange', 1, 'common'),
  T(24, 'Cherry Smoothie', 2, 'uncommon'),
  T(25, 'Hibiscus Tea', 1, 'common'),
  T(26, 'Mix Berry Milk', 2, 'common'),
  T(27, 'Four Seasons Oolong', 1, 'common'),
]

// ─── Set 2: the cosmos holo set (owner-supplied 2026-11-16) ─────────────────
// Same 27 drinks, same stars/tiers as Set 1 (Genesis), different art line.
// Global collector numbering continues: Set 2 = ids 28–54 of 54.
export const CARDS: CardDef[] = [
  ...SET1,
  ...SET1.map((c) => ({ ...c, id: c.id + 27, art: art2(c.id) })),
]

export const CARD_BY_ID: Record<number, CardDef> = Object.fromEntries(
  CARDS.map((c) => [c.id, c]),
)

export const POOL_BY_TIER: Record<Tier, number[]> = {
  common: CARDS.filter((c) => c.tier === 'common').map((c) => c.id),
  uncommon: CARDS.filter((c) => c.tier === 'uncommon').map((c) => c.id),
  rare: CARDS.filter((c) => c.tier === 'rare').map((c) => c.id),
  epic: CARDS.filter((c) => c.tier === 'epic').map((c) => c.id),
  legendary: CARDS.filter((c) => c.tier === 'legendary').map((c) => c.id),
}

export interface TierMeta {
  /** sort rank, ascending = weaker */
  rank: number
  /** points credited when a duplicate of this tier is pulled */
  dupPoints: number
  /** aura / leak-glow colour (honest foreshadowing: always the best card's tier) */
  glow: string
  /** data-rarity value for the vendored pokemon-cards-css (see GachaCard) */
  dataRarity: string
  /** CSS-friendly RGB triplet of the glow, for shadows */
  glowRgb: string
}

export const TIER_META: Record<Tier, TierMeta> = {
  common: { rank: 0, dupPoints: 5, glow: '#ffffff', glowRgb: '255,255,255', dataRarity: 'common' },
  uncommon: { rank: 1, dupPoints: 10, glow: '#9fd8ff', glowRgb: '159,216,255', dataRarity: 'reverse holo' },
  rare: { rank: 2, dupPoints: 25, glow: '#4da3ff', glowRgb: '77,163,255', dataRarity: 'rare holo' },
  epic: { rank: 3, dupPoints: 60, glow: '#c86bff', glowRgb: '200,107,255', dataRarity: 'rare holo cosmos' },
  legendary: { rank: 4, dupPoints: 150, glow: '#ffb340', glowRgb: '255,179,64', dataRarity: 'rare rainbow' },
}

export const TIER_ORDER: Tier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
