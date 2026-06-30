import { describe, it, expect } from 'vitest';
import { parseBazaarMessage } from '../src/types';
import { TemplatedSummarizer } from '../src/llm';

describe('parseBazaarMessage', () => {
  it('parses a valid job-request message', () => {
    const raw = JSON.stringify({
      kind: 'job-request',
      service: 'repo-risk-analysis',
      jobId: 'j1',
      repoUrl: 'https://github.com/x/y',
      replyTo: '@scout',
    });
    const msg = parseBazaarMessage(raw);
    expect(msg).not.toBeNull();
    expect(msg?.kind).toBe('job-request');
  });

  it('returns null for JSON that is not a bazaar message', () => {
    expect(parseBazaarMessage(JSON.stringify({ kind: 'something-else' }))).toBeNull();
    expect(parseBazaarMessage(JSON.stringify({ hello: 'world' }))).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseBazaarMessage('not json at all')).toBeNull();
    expect(parseBazaarMessage('')).toBeNull();
  });
});

describe('TemplatedSummarizer', () => {
  it('reports the mode as templated', () => {
    expect(new TemplatedSummarizer().mode).toBe('templated');
  });

  it('produces a deterministic summary citing score, band, and top signals', async () => {
    const out = await new TemplatedSummarizer().summarize({
      repo: 'octocat/hello',
      riskScore: 42,
      riskBand: 'medium',
      signals: [
        { name: 'stale-repo', detail: 'no commits in 14 months', weight: 25 },
        { name: 'known-cve', detail: '2 high-severity advisories', weight: 30 },
      ],
    });
    expect(out).toContain('octocat/hello');
    expect(out).toContain('42/100');
    expect(out).toContain('medium');
    // Highest-weight signal must be surfaced.
    expect(out).toContain('known-cve');
  });

  it('handles an empty signal list gracefully', async () => {
    const out = await new TemplatedSummarizer().summarize({
      repo: 'octocat/clean',
      riskScore: 0,
      riskBand: 'low',
      signals: [],
    });
    expect(out).toContain('No notable risk signals');
  });
});
