import type { SphereAgent } from '../sphere-agent.js';
import { createLogger, type Logger } from '../logger.js';
import { commitHash, isMove, judge, makeNonce, randomMove, type Move, type Outcome } from './rps.js';

export interface GameDealerOptions {
  /** The house wallet — pays winners and holds the prize treasury. */
  agent: SphereAgent;
  /** UCT paid to the player on a win (default 1). */
  rewardUct?: number;
  /** Mint more when the treasury drops below this (default 10). */
  minTreasuryUct?: number;
  /** Amount minted when topping up (default 50). */
  mintUct?: number;
  /** Unplayed rounds expire after this (default 2 min). */
  roundTtlMs?: number;
  /** Minimum gap between rounds from the same address (default 1.5s). */
  cooldownMs?: number;
  logger?: Logger;
}

interface Round {
  move: Move;
  nonce: string;
  commit: string;
  createdAt: number;
}

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
  /** On-chain transfer id of the payout (Sphere aggregator transfer). */
  txId?: string;
  /** Aggregator commitment request-id hex — the on-chain settlement reference. */
  txRef?: string;
  /** 'landed' = delivered to the winner's mailbox; 'pending-delivery' = certified, awaiting delivery. */
  delivery?: string;
}

/** The slice of the SDK's TransferResult we surface as on-chain proof. */
interface TxLike {
  id?: string;
  deliveryState?: string;
  tokenTransfers?: { requestIdHex?: string }[];
}

export interface LeaderRow {
  name: string;
  wins: number;
  losses: number;
  ties: number;
  played: number;
  earnedUct: number;
}

/**
 * GameDealer — an autonomous rock-paper-scissors house.
 *
 * Provably fair: it commits to sha256(move:nonce) before the player picks, then
 * reveals move + nonce so the client can verify it never changed its move. On a
 * win it sends the player real testnet UCT from the house wallet — a genuine,
 * on-chain, agent-initiated payout (no human in the loop).
 */
export class GameDealer {
  private readonly agent: SphereAgent;
  private readonly reward: number;
  private readonly minTreasury: number;
  private readonly mintAmount: number;
  private readonly ttl: number;
  private readonly cooldown: number;
  private readonly log: Logger;

  private readonly rounds = new Map<string, Round>();
  private readonly lastPlay = new Map<string, number>();
  private readonly board = new Map<string, LeaderRow>();
  private payLock: Promise<void> = Promise.resolve();

  constructor(opts: GameDealerOptions) {
    this.agent = opts.agent;
    this.reward = opts.rewardUct ?? 1;
    this.minTreasury = opts.minTreasuryUct ?? 10;
    this.mintAmount = opts.mintUct ?? 50;
    this.ttl = opts.roundTtlMs ?? 120_000;
    this.cooldown = opts.cooldownMs ?? 1_500;
    this.log = opts.logger ?? createLogger('dealer');
  }

  get house(): string {
    return this.agent.nametag;
  }
  get rewardUct(): number {
    return this.reward;
  }

  async start(): Promise<void> {
    await this.ensureTreasury();
    this.log.info(`arcade dealer ready — house @${this.house}, reward ${this.reward} UCT/win`);
  }

  /** Deal a fresh round: pick + commit a secret move, return the commitment. */
  newRound(playerAddress?: string): NewRound {
    this.sweep();
    if (playerAddress) {
      const last = this.lastPlay.get(playerAddress) ?? 0;
      if (Date.now() - last < this.cooldown) {
        throw new Error('Easy there — wait a moment before the next round.');
      }
    }
    const move = randomMove();
    const nonce = makeNonce();
    const commit = commitHash(move, nonce);
    const roundId = `rps-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.rounds.set(roundId, { move, nonce, commit, createdAt: Date.now() });
    return { roundId, commit, rewardUct: this.reward, house: this.house };
  }

  /** Reveal, judge, and (on a win) pay the player on-chain. */
  async play(input: {
    roundId: string;
    playerMove: unknown;
    playerAddress?: string;
    name?: string;
  }): Promise<PlayResult> {
    const round = this.rounds.get(input.roundId);
    if (!round) throw new Error('Round not found or already played — start a new one.');
    if (!isMove(input.playerMove)) throw new Error('Pick rock, paper, or scissors.');
    this.rounds.delete(input.roundId); // one-shot: a commitment is spent once

    const playerMove = input.playerMove;
    const outcome = judge(playerMove, round.move);
    const name = (input.name || input.playerAddress || 'anon').replace(/^@/, '').slice(0, 24);
    if (input.playerAddress) this.lastPlay.set(input.playerAddress, Date.now());

    let paid = false;
    let payoutError: string | undefined;
    let tx: TxLike | undefined;
    if (outcome === 'win' && input.playerAddress) {
      try {
        tx = await this.payout(input.playerAddress);
        paid = true;
      } catch (e) {
        payoutError = e instanceof Error ? e.message : 'payout failed';
        this.log.warn(`payout to ${input.playerAddress.slice(0, 16)}… failed: ${payoutError}`);
      }
    }
    this.record(name, outcome, paid ? this.reward : 0);

    return {
      roundId: input.roundId,
      playerMove,
      dealerMove: round.move,
      nonce: round.nonce,
      commit: round.commit,
      outcome,
      rewardUct: this.reward,
      paid,
      ...(payoutError ? { payoutError } : {}),
      ...(tx?.id ? { txId: tx.id } : {}),
      ...(tx?.tokenTransfers?.[0]?.requestIdHex ? { txRef: tx.tokenTransfers[0].requestIdHex } : {}),
      ...(tx?.deliveryState ? { delivery: tx.deliveryState } : {}),
    };
  }

  leaderboard(limit = 10): LeaderRow[] {
    return [...this.board.values()]
      .sort((a, b) => b.wins - a.wins || b.earnedUct - a.earnedUct || a.played - b.played)
      .slice(0, limit);
  }

  // ---- internals ----

  /** Serialize house sends so concurrent wins never race on coin selection. */
  private payout(address: string): Promise<TxLike> {
    const run = this.payLock.then(async () => {
      await this.ensureTreasury();
      return (await this.agent.send(address, this.reward, 'arcade-rps-win')) as unknown as TxLike;
    });
    // Keep the chain alive regardless of this payout's outcome.
    this.payLock = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private record(name: string, outcome: Outcome, earned: number): void {
    const row = this.board.get(name) ?? { name, wins: 0, losses: 0, ties: 0, played: 0, earnedUct: 0 };
    row.played += 1;
    if (outcome === 'win') row.wins += 1;
    else if (outcome === 'lose') row.losses += 1;
    else row.ties += 1;
    row.earnedUct += earned;
    this.board.set(name, row);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, r] of this.rounds) {
      if (now - r.createdAt > this.ttl) this.rounds.delete(id);
    }
  }

  private async ensureTreasury(): Promise<void> {
    try {
      const balance = Number(await this.agent.balanceUct());
      if (balance < this.minTreasury) {
        this.log.info(`house treasury ${balance} UCT — minting ${this.mintAmount}`);
        await this.agent.mintUct(this.mintAmount);
      }
    } catch (e) {
      this.log.warn('treasury check failed', e instanceof Error ? e.message : e);
    }
  }
}
