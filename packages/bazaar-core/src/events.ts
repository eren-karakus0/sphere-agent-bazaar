import fs from 'node:fs';
import path from 'node:path';

/**
 * Lightweight append-only event log. Agents emit structured economy events to a
 * shared JSONL file; the dashboard server tails it and streams to the UI. This
 * is telemetry only — emitting must never throw into the agent's hot path.
 */
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
  /** Nametag/name of the agent that emitted the event. */
  actor: string;
  role?: 'provider' | 'client';
  jobId?: string;
  repo?: string;
  counterparty?: string;
  amountUct?: string;
  riskScore?: number;
  riskBand?: string;
  detail?: string;
}

export interface EventLog {
  readonly path: string;
  emit(ev: Omit<BazaarEvent, 'ts'>): void;
}

export function eventLogPath(dataRoot: string): string {
  return path.join(dataRoot, 'events.jsonl');
}

export function createEventLog(filePath: string): EventLog {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  } catch {
    /* ignore */
  }
  return {
    path: filePath,
    emit(ev) {
      try {
        fs.appendFileSync(filePath, `${JSON.stringify({ ts: Date.now(), ...ev })}\n`);
      } catch {
        /* telemetry must never break the agent */
      }
    },
  };
}
