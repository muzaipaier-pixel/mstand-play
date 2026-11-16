// ─── Sound: ZzFX parameter-array presets (MIT, no audio files) ──────────────
// Every sound is synthesized by ZzFX at play time — zero assets to load.
// Sounds only ever start from the pack-opening gesture chain, which satisfies
// the browser autoplay policy. The mute flag lives in the shared save.

import { zzfx } from 'zzfx'
import { useGameStore } from '../store/useGameStore'
import type { Tier } from '../data/cards'

function play(params: number[]) {
  if (useGameStore.getState().settings.muted) return
  try {
    zzfx(...params)
  } catch {
    /* audio is decoration — never let it break the game */
  }
}

function later(fn: () => void, ms: number) {
  window.setTimeout(fn, ms)
}

/** Foil rip — noise burst with a falling sweep, played when the tear commits. */
export function tearRip() {
  play([1.5, 0.35, 1500, 0.01, 0.2, 0.34, 4, 1.2, -5, -1, 0, 0, 0, 0, 0.4, 0, 0, 0, 0.55, 0.25, 0])
  play([1.1, 0.2, 320, 0.01, 0.12, 0.22, 2, 1, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0.15, 0])
}

/** Short crinkle while the guest drags the tear strip. */
export function tearCrinkle() {
  play([0.5, 0.5, 2000, 0, 0.03, 0.06, 4, 1, -2, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0.4, 0.03, 0])
}

// Pentatonic ladder (C major pentatonic) — each successive flip ticks one
// step higher, so a pack audibly climbs toward the hero card.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]

export function flipTick(step: number) {
  const f = PENTA[Math.min(step, PENTA.length - 1)]
  play([0.55, 0.05, f, 0, 0.05, 0.09, 1, 1.6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0.05, 0])
}

/** Reveal stinger, layered by the best card's tier. */
export function revealStinger(tier: Tier) {
  if (tier === 'legendary') {
    // boom + rising arpeggio + shimmer
    play([1.7, 0.1, 130, 0.01, 0.4, 0.55, 1, 1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0.4, 0])
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      later(() => play([0.7, 0.05, f, 0, 0.12, 0.3, 0, 1.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0.2, 0]), i * 85),
    )
    later(
      () => play([0.5, 0.3, 2400, 0.02, 0.3, 0.5, 0, 1, 3, 1, 0, 0, 0, 0, 0.2, 0, 0, 0, 0.6, 0.4, 0]),
      360,
    )
  } else if (tier === 'epic') {
    ;[659.25, 783.99, 1046.5].forEach((f, i) =>
      later(() => play([0.6, 0.05, f, 0, 0.1, 0.25, 0, 1.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0.18, 0]), i * 75),
    )
  } else if (tier === 'rare') {
    ;[587.33, 880.0].forEach((f, i) =>
      later(() => play([0.5, 0.05, f, 0, 0.08, 0.2, 1, 1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0.14, 0]), i * 70),
    )
  } else {
    flipTick(4)
  }
}

/** Two-note coin chirp for the free recharge / points credit. */
export function coinChime() {
  play([0.55, 0.05, 987.77, 0, 0.07, 0.1, 0, 1.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0.06, 0])
  later(() => play([0.55, 0.05, 1318.5, 0, 0.1, 0.28, 0, 1.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0.2, 0]), 70)
}
