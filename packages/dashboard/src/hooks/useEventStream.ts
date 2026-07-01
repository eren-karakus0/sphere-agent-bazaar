import { useEffect, useRef, useState } from 'react';
import type { BazaarEvent } from '../types';
import { BACKEND_URL, hasBackend } from '../lib/backend';

export type FeedMode = 'connecting' | 'live' | 'replay';

/**
 * Feeds the dashboard. When a live backend is configured it streams the real
 * economy over SSE; otherwise (or if the backend is unreachable) it replays a
 * recorded snapshot so the public URL still shows a real run.
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
    if (hasBackend()) {
      try {
        es = new EventSource(`${BACKEND_URL}/api/stream`);
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
    }

    // Fall back to the recorded snapshot if no live feed connects.
    const fallback = setTimeout(
      () => {
        if (live.current) return;
        fetch('/snapshot.json')
          .then((r) => (r.ok ? r.json() : []))
          .then((arr: BazaarEvent[]) => {
            if (live.current || !Array.isArray(arr) || arr.length === 0) return;
            arr.forEach(add);
            setMode('replay');
          })
          .catch(() => {});
      },
      hasBackend() ? 3000 : 400,
    );

    return () => {
      clearTimeout(fallback);
      es?.close();
    };
  }, []);

  return { events, mode };
}
