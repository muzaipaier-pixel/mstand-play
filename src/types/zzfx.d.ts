// zzfx (MIT) ships no TypeScript types — minimal declaration for the
// parameter-array synth entry point used by audio/sfx.ts.
declare module 'zzfx' {
  export function zzfx(...parameters: number[]): { stop?: () => void } | undefined
  export const ZZFX: {
    volume: number
    audioContext: AudioContext
    play: (...parameters: number[]) => unknown
    getNote: (semitoneOffset: number, rootNoteFrequency?: number) => number
  }
}
