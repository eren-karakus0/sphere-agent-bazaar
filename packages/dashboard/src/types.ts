// Mirror of @bazaar/core's BazaarEvent (kept local so the browser bundle never
// pulls in the Node-only core package).
export type BazaarEventType =
  | 'agent:online'
  | 'service:posted'
  | 'service:discovered'
  | 'job:requested'
  | 'job:quoted'
  | 'payment:sent'
  | 'job:paid'
  | 'job:analyzing'
  | 'job:delivered'
  | 'job:rejected';

export interface BazaarEvent {
  ts: number;
  type: BazaarEventType;
  actor: string;
  role?: 'provider' | 'client';
  jobId?: string;
  repo?: string;
  counterparty?: string;
  amountUct?: string;
  riskScore?: number;
  riskBand?: 'low' | 'medium' | 'high' | 'critical';
  detail?: string;
}
