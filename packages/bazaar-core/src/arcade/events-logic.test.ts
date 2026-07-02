import { describe, expect, it } from 'vitest';
import {
  applyLoss,
  applyWin,
  dailyView,
  DAILY_GOAL,
  DAILY_REWARD,
  newPlayerState,
  streakBonus,
  topUpChips,
  DAILY_CHIPS,
} from './events-logic.js';

describe('streak bonus', () => {
  it('pays one-time milestones and nothing in between', () => {
    expect(streakBonus(1)).toBe(0);
    expect(streakBonus(2)).toBe(0);
    expect(streakBonus(3)).toBe(2);
    expect(streakBonus(4)).toBe(0);
    expect(streakBonus(5)).toBe(3);
    expect(streakBonus(10)).toBe(5);
    expect(streakBonus(15)).toBe(5);
  });
});

describe('applyWin / applyLoss', () => {
  it('builds a streak and tracks the best', () => {
    let s = newPlayerState();
    for (let i = 0; i < 4; i++) s = applyWin(s, '2026-07-01').state;
    expect(s.streak).toBe(4);
    expect(s.best).toBe(4);
    s = applyLoss(s);
    expect(s.streak).toBe(0);
    expect(s.best).toBe(4);
  });

  it('claims the daily reward exactly once when the goal is reached', () => {
    let s = newPlayerState();
    let claims = 0;
    let paid = 0;
    for (let i = 0; i < DAILY_GOAL + 3; i++) {
      const u = applyWin(s, '2026-07-01');
      s = u.state;
      if (u.dailyJustClaimed) claims += 1;
      paid += u.dailyBonus;
    }
    expect(claims).toBe(1);
    expect(paid).toBe(DAILY_REWARD);
    expect(s.dailyClaimed).toBe(true);
  });

  it('resets daily progress on a new day', () => {
    let s = newPlayerState();
    s = applyWin(s, '2026-07-01').state;
    s = applyWin(s, '2026-07-01').state;
    expect(dailyView(s, '2026-07-01').wins).toBe(2);
    const next = applyWin(s, '2026-07-02');
    expect(next.state.dailyWins).toBe(1);
    expect(next.state.dailyClaimed).toBe(false);
  });

  it('dailyView normalizes a stale window to zero', () => {
    let s = newPlayerState();
    s = applyWin(s, '2026-07-01').state;
    expect(dailyView(s, '2026-07-02')).toEqual({ goal: DAILY_GOAL, wins: 0, claimed: false });
  });
});

describe('daily chip top-up', () => {
  it('tops a fresh player up to the floor, once per day', () => {
    const day = '2026-07-02';
    const first = topUpChips(newPlayerState(), day);
    expect(first.state.chips).toBe(DAILY_CHIPS);
    expect(first.granted).toBe(DAILY_CHIPS);
    const again = topUpChips(first.state, day);
    expect(again.granted).toBe(0);
  });

  it('never drips onto a stack already above the floor', () => {
    const rich = { ...newPlayerState(), chips: 90, chipsDay: '2026-07-01' };
    const t = topUpChips(rich, '2026-07-02');
    expect(t.state.chips).toBe(90);
    expect(t.granted).toBe(0);
  });

  it('refills a busted stack on the next day', () => {
    const busted = { ...newPlayerState(), chips: 3, chipsDay: '2026-07-01' };
    const t = topUpChips(busted, '2026-07-02');
    expect(t.state.chips).toBe(DAILY_CHIPS);
    expect(t.granted).toBe(DAILY_CHIPS - 3);
  });
});
