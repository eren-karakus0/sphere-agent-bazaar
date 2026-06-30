import { useEffect, useRef, useState } from 'react';
import type { BazaarEvent } from '../types';

/** Subscribe to the dashboard server's SSE stream of economy events. */
export function useEventStream(): { events: BazaarEvent[]; connected: boolean } {
  const [events, setEvents] = useState<BazaarEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const es = new EventSource('/api/stream');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      try {
        const e = JSON.parse(ev.data) as BazaarEvent;
        const key = `${e.ts}|${e.type}|${e.actor}|${e.jobId ?? ''}|${e.detail ?? ''}`;
        if (seen.current.has(key)) return;
        seen.current.add(key);
        setEvents((prev) => [...prev, e]);
      } catch {
        /* ignore malformed line */
      }
    };
    return () => es.close();
  }, []);

  return { events, connected };
}
