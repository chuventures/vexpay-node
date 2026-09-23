import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export type RecordedRequest = {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: unknown;
};

export type ScriptedResponse = {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
  /** Delay before answering (for timeout tests). */
  delayMs?: number;
};

type Handler = (req: RecordedRequest, index: number) => ScriptedResponse;

/**
 * Real HTTP server with a scripted answer per request. Pass an array (one
 * response per call, last one repeats) or a function for dynamic routes.
 */
export async function mockServer(script: ScriptedResponse[] | Handler) {
  const requests: RecordedRequest[] = [];
  const handler: Handler = Array.isArray(script)
    ? (_req, i) => script[Math.min(i, script.length - 1)]!
    : script;

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const recorded: RecordedRequest = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: raw ? JSON.parse(raw) : undefined,
      };
      const index = requests.push(recorded) - 1;
      const answer = handler(recorded, index);
      const send = () => {
        if (res.destroyed) return;
        res.writeHead(answer.status, { 'content-type': 'application/json', ...answer.headers });
        res.end(answer.body === undefined ? '' : JSON.stringify(answer.body));
      };
      if (answer.delayMs) setTimeout(send, answer.delayMs);
      else send();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
