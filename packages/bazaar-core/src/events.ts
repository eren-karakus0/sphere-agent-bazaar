import fs from 'node:fs';
import path from 'node:path';

/**
 * Economy event bus. Agents emit structured events; consumers subscribe (the
 * live backend's SSE stream) and/or the events are appended to a JSONL file
 * (the local dashboard server tails it). Telemetry only — never throws into the
 * agent's hot path.
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

export type EventListener = (ev: BazaarEvent) => void;

export interface EventBus {
  emit(ev: Omit<BazaarEvent, 'ts'>): void;
  /** Subscribe to new events. Returns an unsubscribe function. */
  subscribe(fn: EventListener): () => void;
  /** Recent events (newest last), for replaying history to a new subscriber. */
  recent(limit?: number): BazaarEvent[];
  readonly file?: string;
}

export function eventLogPath(dataRoot: string): string {
  return path.join(dataRoot, 'events.jsonl');
}

export function createEventBus(opts: { file?: string; keep?: number } = {}): EventBus {
  const subscribers = new Set<EventListener>();
  const ring: BazaarEvent[] = [];
  const keep = opts.keep ?? 500;

  if (opts.file) {
    try {
      fs.mkdirSync(path.dirname(opts.file), { recursive: true });
    } catch {
      /* ignore */
    }
  }

  return {
    file: opts.file,
    emit(ev) {
      const full: BazaarEvent = { ts: Date.now(), ...ev };
      ring.push(full);
      if (ring.length > keep) ring.shift();
      if (opts.file) {
        try {
          fs.appendFileSync(opts.file, `${JSON.stringify(full)}\n`);
        } catch {
          /* telemetry must never break the agent */
        }
      }
      for (const fn of subscribers) {
        try {
          fn(full);
        } catch {
          /* a bad subscriber must not break emit */
        }
      }
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    recent(limit) {
      return limit && limit > 0 ? ring.slice(-limit) : [...ring];
    },
  };
}

/** Backwards-compatible file-backed bus used by the standalone CLI agents. */
export function createEventLog(filePath: string): EventBus {
  return createEventBus({ file: filePath });
}
