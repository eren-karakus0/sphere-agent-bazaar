import type { BazaarEvent, BazaarEventType } from '../types';

export type JobState = 'requested' | 'quoted' | 'paid' | 'analyzing' | 'delivered' | 'rejected';

export const PIPELINE: JobState[] = ['requested', 'quoted', 'paid', 'analyzing', 'delivered'];

export interface Job {
  jobId: string;
  repo?: string;
  client?: string;
  provider?: string;
  state: JobState;
  priceUct?: string;
  riskScore?: number;
  riskBand?: BazaarEvent['riskBand'];
  detail?: string;
  updatedAt: number;
}

export interface AgentNode {
  nametag: string;
  role?: 'provider' | 'client';
  detail?: string;
  lastSeen: number;
}

export interface Stats {
  jobs: number;
  delivered: number;
  uctMoved: number;
  agents: number;
}

const STATE_RANK: Record<JobState, number> = {
  requested: 0,
  quoted: 1,
  paid: 2,
  analyzing: 3,
  delivered: 4,
  rejected: 4,
};

const EVENT_TO_STATE: Partial<Record<BazaarEventType, JobState>> = {
  'job:requested': 'requested',
  'job:quoted': 'quoted',
  'payment:sent': 'paid',
  'job:paid': 'paid',
  'job:analyzing': 'analyzing',
  'job:delivered': 'delivered',
  'job:rejected': 'rejected',
};

export function deriveJobs(events: BazaarEvent[]): Job[] {
  const jobs = new Map<string, Job>();
  for (const e of events) {
    if (!e.jobId) continue;
    const j: Job = jobs.get(e.jobId) ?? { jobId: e.jobId, state: 'requested', updatedAt: e.ts };

    const next = EVENT_TO_STATE[e.type];
    if (next && (next === 'rejected' || STATE_RANK[next] >= STATE_RANK[j.state])) j.state = next;

    if (e.repo) j.repo = e.repo;
    if (e.role === 'client') {
      j.client = e.actor;
      if (e.counterparty) j.provider = e.counterparty;
    }
    if (e.role === 'provider') {
      j.provider = e.actor;
      if (e.counterparty) j.client = e.counterparty;
    }
    if (e.amountUct) j.priceUct = e.amountUct;
    if (e.riskScore !== undefined) j.riskScore = e.riskScore;
    if (e.riskBand) j.riskBand = e.riskBand;
    if (e.detail) j.detail = e.detail;
    j.updatedAt = e.ts;
    jobs.set(e.jobId, j);
  }
  return [...jobs.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deriveAgents(events: BazaarEvent[]): AgentNode[] {
  const agents = new Map<string, AgentNode>();
  for (const e of events) {
    if (!e.actor) continue;
    const a: AgentNode = agents.get(e.actor) ?? { nametag: e.actor, lastSeen: e.ts };
    if (e.role) a.role = e.role;
    if (e.type === 'agent:online' && e.detail) a.detail = e.detail;
    a.lastSeen = Math.max(a.lastSeen, e.ts);
    agents.set(e.actor, a);
  }
  return [...agents.values()];
}

export function deriveStats(events: BazaarEvent[], jobs: Job[]): Stats {
  let uctMoved = 0;
  const actors = new Set<string>();
  for (const e of events) {
    if (e.type === 'payment:sent' && e.amountUct) uctMoved += Number(e.amountUct) || 0;
    if (e.actor) actors.add(e.actor);
  }
  return {
    jobs: jobs.length,
    delivered: jobs.filter((j) => j.state === 'delivered').length,
    uctMoved,
    agents: actors.size,
  };
}

export function bandColor(band?: string): string {
  switch (band) {
    case 'low':
      return 'var(--risk-low)';
    case 'medium':
      return 'var(--risk-medium)';
    case 'high':
      return 'var(--risk-high)';
    case 'critical':
      return 'var(--risk-critical)';
    default:
      return 'var(--text-faint)';
  }
}
