// Local static server for development: node scripts/serve.mjs [port]
// Serves the published layout (scripts/assemble-site.mjs owns it), so the page is at the root, as on
// GitHub Pages. build.json is made per request from the working copy, marked dev.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileFor, buildInfo } from './assemble-site.mjs';

const PORT = Number(process.argv[2] ?? 8080);
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain',
};

createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (urlPath === '/build.json') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ...buildInfo(), dev: true }));
  }
  const file = fileFor(urlPath);
  if (!file) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type.startsWith('font/') ? type : `${type}; charset=utf-8` });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${PORT}/`));
