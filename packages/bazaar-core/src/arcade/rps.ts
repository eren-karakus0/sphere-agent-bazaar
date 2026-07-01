import { createHash, randomBytes } from 'node:crypto';

/**
 * Rock–paper–scissors primitives, kept pure and dependency-free so they are
 * trivially testable and identical on both sides of the provably-fair
 * commit/reveal (the browser re-hashes `${move}:${nonce}` to check the dealer
 * never changed its move after seeing yours).
 */
export type Move = 'rock' | 'paper' | 'scissors';
export const MOVES: readonly Move[] = ['rock', 'paper', 'scissors'];

/** Outcome from the player's perspective. */
export type Outcome = 'win' | 'lose' | 'tie';

const BEATS: Record<Move, Move> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

export function isMove(x: unknown): x is Move {
  return x === 'rock' || x === 'paper' || x === 'scissors';
}

/** Judge a round from the player's perspective. */
export function judge(player: Move, dealer: Move): Outcome {
  if (player === dealer) return 'tie';
  return BEATS[player] === dealer ? 'win' : 'lose';
}

/** Uniform random move (rejection sampling to avoid modulo bias). */
export function randomMove(): Move {
  let byte = 252;
  while (byte >= 252) {
    // 252 = 84 * 3 — the largest multiple of 3 that fits in a byte.
    byte = randomBytes(1)[0] ?? 0;
  }
  return MOVES[byte % 3] as Move;
}

export function makeNonce(): string {
  return randomBytes(16).toString('hex');
}

/** The dealer's commitment: sha256 of the move + a secret nonce. */
export function commitHash(move: Move, nonce: string): string {
  return createHash('sha256').update(`${move}:${nonce}`).digest('hex');
}
