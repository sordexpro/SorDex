// Local development server: serves ./public and proxies /api, /ws and /rpc to a SorDex backend.
// Usage: node scripts/dev-server.mjs   (PORT=8080 UPSTREAM=https://sordexpro.com)
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const PORT = Number(process.env.PORT || 8080);
const UPSTREAM = new URL(process.env.UPSTREAM || 'https://sordexpro.com');
const lib = UPSTREAM.protocol === 'https:' ? https : http;
const PROXY = /^\/(api|ws|rpc)(\/|$|\?)/;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

function upstreamHeaders(h) {
  const out = { ...h, host: UPSTREAM.host };
  delete out.origin; delete out.referer;
  return out;
}

const server = http.createServer((req, res) => {
  if (PROXY.test(req.url)) {
    const p = lib.request({ host: UPSTREAM.hostname, port: UPSTREAM.port || undefined, path: req.url, method: req.method,
      headers: upstreamHeaders(req.headers) }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    p.on('error', () => { res.writeHead(502); res.end('Upstream unavailable'); });
    req.pipe(p);
    return;
  }
  const clean = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, path.normalize(clean));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');   // SPA routes
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

server.on('upgrade', (req, socket, head) => {
  if (!PROXY.test(req.url)) { socket.destroy(); return; }
  const p = lib.request({ host: UPSTREAM.hostname, port: UPSTREAM.port || undefined, path: req.url, method: 'GET',
    headers: upstreamHeaders(req.headers) });
  p.on('upgrade', (r, up, upHead) => {
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(r.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`);
    if (upHead.length) socket.write(upHead);
    if (head.length) up.write(head);
    up.pipe(socket); socket.pipe(up);
    up.on('error', () => socket.destroy()); socket.on('error', () => up.destroy());
  });
  p.on('error', () => socket.destroy());
  p.end();
});

server.listen(PORT, () => console.log(`SorDex frontend: http://localhost:${PORT}  (API -> ${UPSTREAM.origin})`));
