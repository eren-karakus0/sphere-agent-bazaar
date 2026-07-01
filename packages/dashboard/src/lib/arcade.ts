/**
 * Client for the Agent Arcade — a provably-fair rock-paper-scissors house.
 * The dealer commits sha256(move:nonce) before you pick; after the reveal the
 * browser re-hashes it (verifyCommit) to prove the move was fixed in advance.
 */
import { BACKEND_URL, hasBackend } from './backend';

export type Move = 'rock' | 'paper' | 'scissors';
export type Outcome = 'win' | 'lose' | 'tie';

export interface NewRound {
  roundId: string;
  commit: string;
  rewardUct: number;
  house: string;
}

export interface PlayResult {
  roundId: string;
  playerMove: Move;
  dealerMove: Move;
  nonce: string;
  commit: string;
  outcome: Outcome;
  rewardUct: number;
  paid: boolean;
  payoutError?: string;
}

export interface LeaderRow {
  name: string;
  wins: number;
  losses: number;
  ties: number;
  played: number;
  earnedUct: number;
}

export interface Leaderboard {
  ready: boolean;
  house: string | null;
  rewardUct: number;
  rows: LeaderRow[];
}

export { hasBackend };

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const d = (await r.json()) as T & { error?: string };
  if (!r.ok || d.error) throw new Error(d.error ?? 'request failed');
  return d;
}

export function newRound(address?: string): Promise<NewRound> {
  return post<NewRound>('/api/arcade/new', { address });
}

export function playRound(input: {
  roundId: string;
  move: Move;
  address?: string;
  name?: string;
}): Promise<PlayResult> {
  return post<PlayResult>('/api/arcade/play', input);
}

export async function fetchLeaderboard(): Promise<Leaderboard> {
  const r = await fetch(`${BACKEND_URL}/api/arcade/leaderboard`, {
    signal: AbortSignal.timeout(8_000),
  });
  return (await r.json()) as Leaderboard;
}

/** Re-hash the reveal to confirm the dealer never changed its committed move. */
export async function verifyCommit(move: string, nonce: string, commit: string): Promise<boolean> {
  const data = new TextEncoder().encode(`${move}:${nonce}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === commit;
}
