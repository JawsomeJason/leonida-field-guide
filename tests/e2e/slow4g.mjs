// A slow-4G link in front of a local server: every response waits one round trip (150 ms) and then shares one 1.6 Mbps pipe.
// It sits between the browser and the server, so the page's requests and the service worker's own fetches are both slowed;
// CDP network throttling only reaches the page. Pair it with the 4x CPU slowdown (`slowCpu`).
import { request, createServer } from 'node:http';

/** Starts the proxy; resolves to { url, close }. `target` is the base URL of the real server. */
export async function slowProxy(target, { rtt = 150, bytesPerSecond = 200_000 } = {}) {
  const upstream = new URL(target);
  let busyUntil = 0; // when the shared pipe is free again
  const server = createServer((req, res) => {
    const up = request({ host: upstream.hostname, port: upstream.port, path: req.url, method: req.method, headers: req.headers }, (answer) => {
      const chunks = [];
      answer.on('data', (c) => chunks.push(c));
      answer.on('end', () => {
        const body = Buffer.concat(chunks);
        busyUntil = Math.max(Date.now() + rtt, busyUntil) + (body.length / bytesPerSecond) * 1000;
        const { 'transfer-encoding': _, ...headers } = answer.headers;
        setTimeout(() => !res.destroyed && res.writeHead(answer.statusCode, { ...headers, 'content-length': body.length }).end(body), busyUntil - Date.now());
      });
    });
    up.on('error', () => res.destroy());
    req.pipe(up);
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((ok) => (server.closeAllConnections(), server.close(ok))) };
}

/** The 4x CPU slowdown Lighthouse mobile uses. */
export const slowCpu = async (context, page) => (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
