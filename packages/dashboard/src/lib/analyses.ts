/**
 * Per-user analysis history, stored client-side keyed by the connected wallet
 * identity. Each wallet sees only its own analyses.
 */
export interface WalletIdentityLike {
  nametag?: string;
  chainPubkey?: string;
  directAddress?: string;
}

export interface AnalysisRecord {
  repo: string;
  riskScore: number;
  riskBand: string;
  ts: number;
  source?: 'agents' | 'instant';
}

const MAX = 50;

export function userKey(id: WalletIdentityLike): string {
  const who = (id.nametag ?? id.chainPubkey ?? id.directAddress ?? 'anon').replace(/^@/, '');
  return `bazaar:analyses:${who}`;
}

export function loadAnalyses(key: string): AnalysisRecord[] {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? (JSON.parse(raw) as AnalysisRecord[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveAnalyses(key: string, list: AnalysisRecord[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}
