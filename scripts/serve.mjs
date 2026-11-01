// Tiny dependency-free local development server. The PWA requires localhost or HTTPS.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
const base = resolve('www');
const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const port = Number(process.env.PORT || 4173);
http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const path = resolve(join(base, pathname.replace(/^\/+/, '') || 'index.html'));
    if (path !== base && !path.startsWith(base + sep)) throw new Error('Invalid path');
    const info = await stat(path);
    if (!info.isFile()) throw new Error('Not a file');
    const ext = path.slice(path.lastIndexOf('.'));
    res.writeHead(200,{ 'Content-Type':types[ext] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff' });
    res.end(await readFile(path));
  } catch { res.writeHead(404);res.end('Not found'); }
}).listen(port,'127.0.0.1',()=>console.log(`Sudoku: http://localhost:${port}`));
