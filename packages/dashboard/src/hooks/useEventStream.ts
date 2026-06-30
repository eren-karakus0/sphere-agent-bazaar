import { useEffect, useRef, useState } from 'react';
import type { BazaarEvent } from '../types';

export type FeedMode = 'connecting' | 'live' | 'replay';

/**
 * Feeds the dashboard. Prefers the live SSE stream from the dashboard server;
 * if no live feed appears shortly (e.g. on a static deploy with no server), it
 * falls back to a recorded snapshot so the public URL still shows a real run.
 */
export function useEventStream(): { events: BazaarEvent[]; mode: FeedMode } {
  const [events, setEvents] = useState<BazaarEvent[]>([]);
  const [mode, setMode] = useState<FeedMode>('connecting');
  const seen = useRef(new Set<string>());
  const live = useRef(false);

  useEffect(() => {
    const add = (e: BazaarEvent) => {
      const key = `${e.ts}|${e.type}|${e.actor}|${e.jobId ?? ''}|${e.detail ?? ''}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      setEvents((prev) => [...prev, e]);
    };

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/stream');
      es.onopen = () => {
        live.current = true;
        setMode('live');
      };
      es.onmessage = (ev) => {
        try {
          add(JSON.parse(ev.data) as BazaarEvent);
        } catch {
          /* ignore malformed line */
        }
      };
    } catch {
      /* EventSource unavailable */
    }

    // Static-deploy fallback: if no live feed connects, replay the snapshot.
    const fallback = setTimeout(() => {
      if (live.current) return;
      fetch('/snapshot.json')
        .then((r) => (r.ok ? r.json() : []))
        .then((arr: BazaarEvent[]) => {
          if (live.current || !Array.isArray(arr) || arr.length === 0) return;
          arr.forEach(add);
          setMode('replay');
        })
        .catch(() => {});
    }, 1500);

    return () => {
      clearTimeout(fallback);
      es?.close();
    };
  }, []);

  return { events, mode };
}
