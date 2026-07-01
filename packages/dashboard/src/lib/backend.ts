/**
 * Client for the live agent-economy backend. When a backend URL is configured
 * (VITE_BACKEND_URL in prod, localhost in dev) the dashboard streams the real
 * economy and routes analyses through the live agents; otherwise it falls back
 * to the instant serverless analyzer and a recorded snapshot.
 */
export const BACKEND_URL: string =
  (import.meta.env.VITE_BACKEND_URL ?? '').trim() ||
  (import.meta.env.DEV ? 'http://localhost:4500' : '');

export function hasBackend(): boolean {
  return BACKEND_URL.length > 0;
}

export interface Report {
  repo: string;
  riskScore: number;
  riskBand: string;
  signals: { name: string; detail: string; weight: number }[];
  summary: string;
  source?: 'agents' | 'instant';
}

/** True when the backend is reachable and its agents are ready. */
export async function checkAgentsLive(): Promise<boolean> {
  if (!hasBackend()) return false;
  try {
    const r = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(4500) });
    if (!r.ok) return false;
    const d = (await r.json()) as { ready?: boolean };
    return d.ready === true;
  } catch {
    return false;
  }
}

/** Trigger a real on-chain job through the live agents; resolves with the report. */
export async function analyzeViaAgents(repo: string): Promise<Report> {
  const r = await fetch(`${BACKEND_URL}/api/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ repo }),
    signal: AbortSignal.timeout(120_000),
  });
  const d = (await r.json()) as Report & { error?: string };
  if (!r.ok || d.error) throw new Error(d.error ?? 'The agents could not complete the job.');
  return { ...d, source: 'agents' };
}

/** Instant analysis via the serverless function (no agents, no wait). */
export async function analyzeInstant(repo: string): Promise<Report> {
  const r = await fetch(`/api/analyze?repo=${encodeURIComponent(repo)}`);
  const d = (await r.json()) as Report & { error?: string };
  if (!r.ok || d.error) throw new Error(d.error ?? 'Analysis failed');
  return { ...d, source: 'instant' };
}
