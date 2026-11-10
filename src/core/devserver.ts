import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface ReloadServer {
  port: number;
  /** Mark that a new build is ready; releases every waiting client. */
  bump(): void;
  close(): Promise<void>;
}

const HOLD_MS = 25_000;

/**
 * Tiny long-poll server. A client asks `/__reload?v=<version>` and gets the answer
 * as soon as the current version differs from the one it holds (or after a timeout).
 */
export async function startReloadServer(requestedPort = 0): Promise<ReloadServer> {
  let version = 1;
  const waiting = new Set<{ res: http.ServerResponse; timer: NodeJS.Timeout }>();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    if (url.pathname !== '/__reload') {
      res.statusCode = 404;
      res.end();
      return;
    }

    const known = url.searchParams.get('v') ?? '';
    if (known !== String(version)) {
      res.end(String(version));
      return;
    }

    const entry = {
      res,
      timer: setTimeout(() => {
        waiting.delete(entry);
        res.end(String(version));
      }, HOLD_MS),
    };
    waiting.add(entry);
    req.on('close', () => {
      clearTimeout(entry.timer);
      waiting.delete(entry);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(requestedPort, '127.0.0.1', resolve);
  });

  return {
    port: (server.address() as AddressInfo).port,
    bump() {
      version += 1;
      for (const entry of waiting) {
        clearTimeout(entry.timer);
        entry.res.end(String(version));
      }
      waiting.clear();
    },
    close() {
      for (const entry of waiting) clearTimeout(entry.timer);
      waiting.clear();
      server.closeAllConnections();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
