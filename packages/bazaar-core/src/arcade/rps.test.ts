import { describe, expect, it } from 'vitest';
import { commitHash, isMove, judge, MOVES, randomMove, type Move } from './rps.js';

describe('rps judge', () => {
  it('ties on identical moves', () => {
    for (const m of MOVES) expect(judge(m, m)).toBe('tie');
  });

  it('scores every non-tie pairing from the player perspective', () => {
    expect(judge('rock', 'scissors')).toBe('win');
    expect(judge('scissors', 'paper')).toBe('win');
    expect(judge('paper', 'rock')).toBe('win');
    expect(judge('scissors', 'rock')).toBe('lose');
    expect(judge('paper', 'scissors')).toBe('lose');
    expect(judge('rock', 'paper')).toBe('lose');
  });

  it('is antisymmetric: swapping players flips win/lose', () => {
    for (const a of MOVES) {
      for (const b of MOVES) {
        const fwd = judge(a, b);
        const rev = judge(b, a);
        if (fwd === 'tie') expect(rev).toBe('tie');
        else expect(rev).toBe(fwd === 'win' ? 'lose' : 'win');
      }
    }
  });
});

describe('rps commit', () => {
  it('is deterministic and move/nonce sensitive', () => {
    const h = commitHash('rock', 'abc');
    expect(h).toBe(commitHash('rock', 'abc'));
    expect(h).not.toBe(commitHash('paper', 'abc'));
    expect(h).not.toBe(commitHash('rock', 'abd'));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('rps randomMove', () => {
  it('only ever returns valid moves', () => {
    for (let i = 0; i < 300; i++) {
      const m: Move = randomMove();
      expect(isMove(m)).toBe(true);
    }
  });
});
