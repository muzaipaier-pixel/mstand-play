# Third-Party Notices

This project is open source under the **GNU General Public License v3.0**
(see `LICENSE`). It incorporates the following third-party work:

## pokemon-cards-css — GPL-3.0

- **Author:** simeydotme (Simon Goellner)
- **Source:** https://github.com/simeydotme/pokemon-cards-css
- **License:** GNU General Public License v3.0
- **What is used:** the card holographic-effect stylesheets
  (`src/vendor/pokemon-cards-css/css/`), its foil texture images
  (`public/img/`: `grain.webp`, `glitter.png`, `cosmos-bottom.png`,
  `cosmos-middle-trans.png`, `cosmos-top-trans.png`, `illusion-mask.png`),
  and the pointer/spring interaction logic of its `Card.svelte`, ported to
  React in `src/components/GachaCard.tsx` (the upstream Svelte component and
  its `Math.js` helpers are kept for reference in
  `src/vendor/pokemon-cards-css/`).
- Vendored files are unmodified apart from a prepended attribution header.
  Project-specific adaptations live in `src/styles/poke-adapter.css`.

Pokémon and Pokémon character names are trademarks of Nintendo. This is a
fan-style visual effect used on original drink cards; no Pokémon artwork,
card scans, or other Nintendo assets are included in this project.

## JavaScript dependencies

| Package | License |
| --- | --- |
| react, react-dom | MIT |
| zustand | MIT |
| motion | MIT |
| zzfx | MIT |
| canvas-confetti | ISC |
| vite, @vitejs/plugin-react (build-time) | MIT |
| typescript (build-time) | Apache-2.0 |

## Game artwork

The 27 drink card faces (`public/cards/`), the pack artwork
(`public/pack.webp`), names and game text in this repository were created
for this game and are released under the same GPL-3.0 license.
