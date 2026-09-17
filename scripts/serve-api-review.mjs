// Local source transfer for the authenticated Supabase dashboard editor.
// Serves this one generated file; never serves environment files or directories.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../supabase/functions/api/index.ts', import.meta.url), 'utf8');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
createServer((request, response) => {
  if (request.url !== '/api-source' || request.method !== 'GET') { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
  response.end(`<title>Backend preparado para Supabase</title><h1>Backend preparado para Supabase</h1><pre>${escape(source)}</pre>`);
}).listen(4387, '127.0.0.1', () => console.log('Backend source: http://127.0.0.1:4387/api-source'));
