import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 4173);

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

function resolvePath(url) {
  const requestedPath = normalize(decodeURIComponent(new URL(url, 'http://localhost').pathname));
  const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.slice(1);
  return join(distDir, relativePath);
}

const server = createServer(async (request, response) => {
  const candidatePath = resolvePath(request.url || '/');
  const filePath = (await stat(candidatePath).catch(() => null))?.isFile()
    ? candidatePath
    : join(distDir, 'index.html');

  response.setHeader(
    'Content-Type',
    contentTypes.get(extname(filePath)) || 'application/octet-stream',
  );
  createReadStream(filePath)
    .on('error', () => {
      response.statusCode = 500;
      response.end('Unable to read asset');
    })
    .pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`web preview listening on http://127.0.0.1:${port}`);
});
