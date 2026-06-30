/**
 * Marketplace protocol types — the on-network contract between provider agents
 * (e.g. the Repo Risk Analyst) and client agents (e.g. AlphaScout).
 *
 * Messages travel as JSON inside Nostr DMs; intents are published to the
 * Unicity market (intent bulletin board). All amounts are human-readable UCT
 * strings (e.g. "5") unless a field name says otherwise.
 */

export const SERVICE_REPO_RISK = 'repo-risk-analysis' as const;
export type ServiceId = typeof SERVICE_REPO_RISK;

/** A provider's advertised service, posted to the market as a `service` intent. */
export interface ServiceListing {
  service: ServiceId;
  version: string;
  priceUct: string;
  currency: 'UCT';
  description: string;
  providerNametag: string;
}

export type RiskBand = 'low' | 'medium' | 'high' | 'critical';

export interface RiskSignal {
  name: string;
  detail: string;
  /** Points this signal contributed to the overall risk score. */
  weight: number;
}

export interface RepoRiskReport {
  repo: string;
  generatedAt: string;
  riskScore: number; // 0–100 (higher = riskier)
  riskBand: RiskBand;
  signals: RiskSignal[];
  summary: string;
  summarizer: 'gemini' | 'templated';
}

// ---- DM protocol (discriminated union on `kind`) ----

export interface JobRequestMessage {
  kind: 'job-request';
  service: ServiceId;
  jobId: string;
  repoUrl: string;
  /** Nametag the result and quote should be sent back to. */
  replyTo: string;
}

export interface JobQuoteMessage {
  kind: 'job-quote';
  jobId: string;
  priceUct: string;
  /** Payment-request id the client must pay to release the job. */
  paymentRequestId?: string;
  note?: string;
}

export interface JobResultMessage {
  kind: 'job-result';
  jobId: string;
  repoUrl: string;
  report: RepoRiskReport;
}

export interface JobRejectMessage {
  kind: 'job-reject';
  jobId: string;
  reason: string;
}

export type BazaarMessage =
  | JobRequestMessage
  | JobQuoteMessage
  | JobResultMessage
  | JobRejectMessage;

export function parseBazaarMessage(raw: string): BazaarMessage | null {
  try {
    const obj = JSON.parse(raw) as { kind?: unknown };
    if (typeof obj.kind !== 'string') return null;
    if (['job-request', 'job-quote', 'job-result', 'job-reject'].includes(obj.kind)) {
      return obj as BazaarMessage;
    }
    return null;
  } catch {
    return null;
  }
}
