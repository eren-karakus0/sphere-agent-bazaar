import { deriveWheelIndex, serverSeed } from '../rng.js';
import type { Game } from './types.js';

/**
 * Lucky Wheel — a two-seed provably-fair spin. The house commits a server
 * seed; the player's spin contributes a client seed; the landing segment
 * derives from sha256 of the two, so neither side can steer the wheel.
 *
 * The layout is public up front (in `publicState`), and the reveal repeats it
 * so the browser can redraw + re-derive the landing independently.
 */
export const WHEEL_SEGMENTS: readonly number[] = [0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 5];

export const wheelGame: Game = {
  id: 'wheel',
  title: 'Lucky Wheel',
  blurb: 'Spin for a bet multiplier — ×1 gives the bet back, ×5 tops the wheel.',
  rewardMult: 5, // display: the top multiplier (actual comes from judge)
  inputKind: 'seed',
  deal() {
    return { secret: serverSeed(), publicState: { segments: [...WHEEL_SEGMENTS] } };
  },
  resolveInput(raw) {
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (!/^[0-9a-zA-Z]{4,64}$/.test(s)) throw new Error('Missing or invalid client seed.');
    return s;
  },
  judge(secret, input) {
    const index = deriveWheelIndex(secret, input as string, WHEEL_SEGMENTS.length);
    const multiplier = WHEEL_SEGMENTS[index]!;
    return {
      // total-return: ×1 pushes the bet back, above 1 wins, 0 loses it
      outcome: multiplier > 1 ? 'win' : multiplier === 1 ? 'tie' : 'lose',
      rewardMult: multiplier,
      reveal: {
        segmentIndex: index,
        multiplier,
        segments: [...WHEEL_SEGMENTS],
        clientSeed: input,
      },
    };
  },
};
