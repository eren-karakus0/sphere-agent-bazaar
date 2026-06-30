import { createSummarizer, type RepoRiskReport } from '@bazaar/core';
import { parseRepoUrl } from './repo-url.js';
import { fetchRepoMeta } from './github.js';
import { scoreRepo } from './scoring.js';

export interface AnalyzeOptions {
  githubToken?: string;
  gemini?: { apiKey?: string; model: string };
}

/**
 * Analyze a GitHub repository and produce a risk report. This is the service the
 * Repo Risk Analyst sells on the network.
 *
 * Flow: SSRF-guarded URL parse → free GitHub metadata → deterministic score →
 * natural-language summary (Gemini, or templated fallback).
 */
export async function analyzeRepo(repoUrl: string, opts: AnalyzeOptions = {}): Promise<RepoRiskReport> {
  const ref = parseRepoUrl(repoUrl); // SSRF guard — throws on non-github input
  const meta = await fetchRepoMeta(ref, opts.githubToken);
  const { score, band, signals } = scoreRepo(meta);

  const summarizer = createSummarizer(opts.gemini ?? { model: 'gemini-2.0-flash' });
  const summary = await summarizer.summarize({
    repo: meta.fullName,
    riskScore: score,
    riskBand: band,
    signals,
  });

  return {
    repo: meta.fullName,
    generatedAt: new Date().toISOString(),
    riskScore: score,
    riskBand: band,
    signals,
    summary,
    summarizer: summarizer.mode,
  };
}
