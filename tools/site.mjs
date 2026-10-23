// Assembles the practice site into _site/ (site files plus the generated data),
// and with --serve previews it at http://localhost:8080.

import { cpSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '_site');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(ROOT, 'site'), OUT, { recursive: true });
cpSync(join(ROOT, 'dist', 'cantonlink-community.json'), join(OUT, 'data.json'));
console.log('✓ Built _site/');

if (process.argv.includes('--serve')) {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
  const port = Number(process.env.PORT ?? 8080);
  createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://localhost').pathname)).replace(/^(\.\.[/\\])+/, '');
    const file = join(OUT, path.endsWith('/') ? `${path}index.html` : path);
    if (!file.startsWith(OUT) || !existsSync(file)) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  }).listen(port, () => console.log(`Previewing at http://localhost:${port}`));
}
