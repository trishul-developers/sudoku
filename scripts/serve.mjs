import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../www');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json',
 '.png':'image/png','.svg':'image/svg+xml'};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const path = resolve(root, relative);
    if (path !== root && !path.startsWith(root + sep)) throw Error('Forbidden');
    const info = await stat(path);
    if (!info.isFile()) throw Error('Not a file');
    res.writeHead(200, {'content-type':types[extname(path)]||'application/octet-stream',
     'cache-control':'no-cache','x-content-type-options':'nosniff'});
    res.end(await readFile(path));
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(4173, '127.0.0.1', () => console.log('Pure Sudoku: http://127.0.0.1:4173'));
