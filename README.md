# M Stand Drink-Card Gacha

A pack-opening (gacha) mini-game: tear open a foil pack, fan out 5 drink
cards, flip them in ascending rarity, and collect all 27. Built with
React + Vite + TypeScript. Japanese UI with a 中文 toggle.

**License: GPL-3.0-only** (see `LICENSE`). This repository is a standalone,
self-contained web game — it contains only the game and its artwork.

## Run / build

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build
```

Serve `dist/` from a site root: the vendored foil textures are referenced
by the library's original absolute paths (`/img/...`), so the game expects
to live at the root of its host.

## How it plays

- A pack costs **50 pt**; the wallet starts at **200 pt** and refills
  **+200 pt for free** when it runs dry. Points, collection and pity
  counters persist in one versioned save (`localStorage` key
  `mstand.play.save.v1`) shared across this site's mini-games.
- The pack is rolled the moment you first touch it, so the light that
  leaks from the tear always matches the best card inside (honest
  foreshadowing). You are charged when the tear commits.
- Ritual: idle bobbing pack → tap/drag to tear → burst (flash, confetti,
  foil shreds) → 5 cards fan out face-down → flips in ascending rarity,
  the best card last with an edge-on hang, conic rays and a dimmed fan →
  summary. A skip button and `prefers-reduced-motion` support included.
- Sound is synthesized live with ZzFX — no audio files. Mutable (♪ button).

## Odds (café-tuned model)

Five cards per pack, rolled by slot:

| Slot | Weights |
| --- | --- |
| 1–3 | Common 75% / Uncommon 25% |
| 4 | Uncommon 70% / Rare 30% |
| 5 (hit) | Rare 82% / Epic 15% / Legendary 3% |

Guarantees: **at least one Rare+ per pack**; **Epic+ guaranteed** after 9
packs without one (the 10th pack's hit slot is Epic+); **Legendary** soft
pity ramps from pack 15, hard pity at pack 25 — a set is always completable
within 25 packs. Duplicates convert to points (Common 5 / Uncommon 10 /
Rare 25 / Epic 60 / Legendary 150).

Tiers (27 cards): Legendary ×1 (#19 Royal Boba), Epic ×2, Rare ×4,
Uncommon ×8, Common ×12 — see `src/data/cards.ts`. The printed ★ rating is
what guests see (★★★ = Rare and above).

## Save schema

One JSON document under `mstand.play.save.v1`:

```ts
{
  version: 1,
  wallet:   { points, lifetimeEarned },
  gacha:    { collection: { [cardId]: { count, firstPulledAt } },
              pity: { packsSinceEpicPlus, packsSinceLegendary },
              stats: { packsOpened, cardsPulled } },
  settings: { muted, lang }   // lang: 'ja' | 'zh'
}
```

`creditPoints()` in `src/store/useGameStore.ts` is the only wallet
mutator, so other mini-games can share the wallet slice safely. Other tabs
stay in sync via the `storage` event.

## The holographic cards (pokemon-cards-css)

The card foil is the original **pokemon-cards-css** by simeydotme
(GPL-3.0), vendored — not re-implemented. See `THIRD-PARTY-NOTICES.md`.

- Stylesheets: `src/vendor/pokemon-cards-css/` (upstream files, imported
  in upstream order: vars → base → regular/reverse/cosmos/rainbow holo).
- Interaction: `src/components/GachaCard.tsx` reproduces the upstream
  `Card.svelte` DOM and ports its spring/pointer driver (same math
  helpers, spring constants and CSS vars).
- Tier → `data-rarity` mapping: Common → `common`, Uncommon →
  `reverse holo`, Rare → `rare holo`, Epic → `rare holo cosmos`,
  Legendary → `rare rainbow`.
- Adaptations (in `src/styles/poke-adapter.css`, upstream files untouched):
  - `--card-aspect` changed 0.718 → 0.6752 for our 640×948 card art.
  - The library clips holo effects to a Pokémon card's illustration
    window; our cards are full-bleed art, so all `--clip*` vars are
    overridden to full-card shapes (in favour of the library's shine
    recipes, which are unchanged).
  - Card.svelte's `:root` var defaults are scoped to `.card`.
  - The card back is a styled div (upstream uses an `<img>`), so the
    adapter adds flex centering and exempts its children from the
    rotator's grid rules.
- Flip: upstream shows the front by default; we park the rotator's
  `springRotateDelta.x` at 180° for face-down cards (the library's
  `.card__back` is pre-rotated 180°) and spring it to 0° to flip. The
  hero card pauses at ~92° (edge-on) for ~430 ms before completing.

## Layout

```
public/cards/01–27.webp   card faces          public/pack.webp  pack art
public/img/               vendored foil textures (GPL-3.0, see notices)
src/data/                 card master data + odds tables
src/game/rollPack.ts      pure pack roller (slots, pity, duplicates)
src/store/useGameStore.ts Zustand + persist save, wallet invariant
src/components/           Pack (tear gesture), Fan, GachaCard, Collection
src/audio/sfx.ts          ZzFX sound presets
src/vendor/               vendored pokemon-cards-css (GPL-3.0)
```
