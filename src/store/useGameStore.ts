// ─── The shared save — ONE versioned key for the whole play site ────────────
// Key: `mstand.play.save.v1`. The document is sliced per game so other
// mini-games on play.kkmurado.com can import this same store module and use
// the shared `wallet` slice instead of forking their own points key:
//
//   {
//     version: 1,
//     wallet:   { points, lifetimeEarned },
//     gacha:    { collection, pity, stats },
//     settings: { muted, lang },
//     // future games add their own top-level slice here
//   }
//
// Invariants (borrowed from Cards of Arcana's applyGoldDelta pattern):
//   • creditPoints() is the ONLY way the balance ever moves.
//   • applyPackResult() is the ONLY way a pack outcome is committed.
// Persisted via zustand/persist; a `storage` listener rehydrates the store
// when another tab (or another game on the same origin) writes the key, so
// two open tabs can't silently clobber each other's points.

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { PackResult, PityState } from '../game/rollPack'
import type { Lang } from '../i18n'

export const SAVE_KEY = 'mstand.play.save.v1'
export const PACK_COST = 50
export const RECHARGE_AMOUNT = 200
export const START_POINTS = 200

export interface CollectionEntry {
  count: number
  firstPulledAt: number
}

interface WalletSlice {
  points: number
  lifetimeEarned: number
}

interface GachaSlice {
  collection: Record<number, CollectionEntry>
  pity: PityState
  stats: { packsOpened: number; duplicatesConverted: number }
}

interface SettingsSlice {
  muted: boolean
  lang: Lang
}

export interface GameState {
  version: 1
  wallet: WalletSlice
  gacha: GachaSlice
  settings: SettingsSlice
  /**
   * The single wallet mutator. Positive amounts credit, negative amounts
   * spend. Returns false (and changes nothing) when a spend would overdraw.
   * `earned` marks points that count toward lifetimeEarned (duplicate
   * conversions) — the free recharge is not "earned".
   */
  creditPoints: (amount: number, earned?: boolean) => boolean
  /** Commit a finished pack: collection, pity, stats and duplicate points. */
  applyPackResult: (result: PackResult) => void
  /** Free top-up offered when the guest can't afford a pack. */
  recharge: () => void
  setMuted: (muted: boolean) => void
  setLang: (lang: Lang) => void
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      version: 1,
      wallet: { points: START_POINTS, lifetimeEarned: 0 },
      gacha: {
        collection: {},
        pity: { packsSinceEpicPlus: 0, packsSinceLegendary: 0 },
        stats: { packsOpened: 0, duplicatesConverted: 0 },
      },
      settings: { muted: false, lang: 'ja' },

      creditPoints: (amount, earned = false) => {
        const { points, lifetimeEarned } = get().wallet
        if (amount < 0 && points + amount < 0) return false
        set({
          wallet: {
            points: points + amount,
            lifetimeEarned: earned && amount > 0 ? lifetimeEarned + amount : lifetimeEarned,
          },
        })
        return true
      },

      applyPackResult: (result) => {
        const state = get()
        const collection = { ...state.gacha.collection }
        let dupCount = 0
        for (const pull of result.pulls) {
          const prev = collection[pull.cardId]
          if (prev) {
            collection[pull.cardId] = { ...prev, count: prev.count + 1 }
            dupCount++
          } else {
            collection[pull.cardId] = { count: 1, firstPulledAt: Date.now() }
          }
        }
        set({
          gacha: {
            collection,
            pity: result.newPity,
            stats: {
              packsOpened: state.gacha.stats.packsOpened + 1,
              duplicatesConverted: state.gacha.stats.duplicatesConverted + dupCount,
            },
          },
        })
        if (result.totalDupPoints > 0) get().creditPoints(result.totalDupPoints, true)
      },

      recharge: () => {
        get().creditPoints(RECHARGE_AMOUNT, false)
      },

      setMuted: (muted) => set({ settings: { ...get().settings, muted } }),
      setLang: (lang) => set({ settings: { ...get().settings, lang } }),
    }),
    {
      name: SAVE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Persist only the save document — never actions or transient UI state.
      partialize: (s) => ({
        version: s.version,
        wallet: s.wallet,
        gacha: s.gacha,
        settings: s.settings,
      }),
      // v1 is the first schema; future versions migrate in sequence here and
      // must never silently reset a guest's wallet/collection.
      migrate: (persisted) => persisted as GameState,
    },
  ),
)

// Cross-tab / cross-game sync: rehydrate when another tab writes the key.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === SAVE_KEY) void useGameStore.persist.rehydrate()
  })
}
