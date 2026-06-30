/**
 * Dashboard server — tails the shared economy event log and streams it to the
 * UI over Server-Sent Events. Also serves the built static frontend in
 * production. Zero coupling to the agents beyond the append-only JSONL file.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, eventLogPath } from '@bazaar/core';

const PORT = Number(process.env.DASHBOARD_PORT ?? 4317);
const env = loadEnv();
const EVENTS_FILE = eventLogPath(env.dataRoot);
const DIST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

function readAllLines(): string[] {
  try {
    return fs.readFileSync(EVENTS_FILE, 'utf8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

const clients = new Set<http.ServerResponse>();

// Tail the file: track byte offset + carry partial trailing line between polls.
let offset = 0;
let carry = '';
function pollNewLines(): void {
  let size = 0;
  try {
    size = fs.statSync(EVENTS_FILE).size;
  } catch {
    return;
  }
  if (size < offset) {
    offset = 0;
    carry = '';
  }
  if (size === offset) return;
  const fd = fs.openSync(EVENTS_FILE, 'r');
  const buf = Buffer.alloc(size - offset);
  fs.readSync(fd, buf, 0, buf.length, offset);
  fs.closeSync(fd);
  offset = size;
  const text = carry + buf.toString('utf8');
  const parts = text.split('\n');
  carry = parts.pop() ?? '';
  for (const line of parts) {
    if (line.trim()) broadcast(line);
  }
}
setInterval(pollNewLines, 700);

function broadcast(line: string): void {
  for (const res of clients) res.write(`data: ${line}\n\n`);
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = (req.url ?? '/').split('?')[0] ?? '/';
  let filePath = path.join(DIST_DIR, url === '/' ? 'index.html' : url);
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html'); // SPA fallback
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404).end('not found (run `pnpm --filter @bazaar/dashboard build` first, or use dev mode)');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream' }).end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0] ?? '/';

  if (url === '/api/events') {
    const events = readAllLines().map((l) => JSON.parse(l));
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(events));
    return;
  }

  if (url === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('retry: 2000\n\n');
    // Replay history so a freshly opened dashboard is complete.
    for (const line of readAllLines()) res.write(`data: ${line}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => {
      clearInterval(ping);
      clients.delete(res);
    });
    return;
  }

  serveStatic(req, res);
});

// Start tailing from the current end so /api/stream history replay (above) and
// the live tail don't double-emit the backlog.
try {
  offset = fs.statSync(EVENTS_FILE).size;
} catch {
  offset = 0;
}

server.listen(PORT, () => {
   
  console.log(`[dashboard] serving on http://localhost:${PORT}  (events: ${EVENTS_FILE})`);
});
