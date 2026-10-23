const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const ROOT = __dirname;
const MAX_BODY = 100 * 1024;
const MAX_MESSAGES = 40;
const MAX_CHARS = 12000;

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY) {
        reject(Object.assign(new Error('Request is too large.'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(Object.assign(new Error('Invalid JSON request.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

async function handleChat(req, res) {
  if (!API_KEY) return send(res, 503, { error: 'AI is not configured yet. Add OPENROUTER_API_KEY to the server environment.' });
  let body;
  try { body = await readJson(req); }
  catch (err) { return send(res, err.status || 400, { error: err.message || 'Could not read request.' }); }

  if (!Array.isArray(body.messages)) return send(res, 400, { error: 'messages must be an array.' });
  const messages = body.messages
    .filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  if (!messages.length || !messages.some(m => m.role === 'user')) {
    return send(res, 400, { error: 'Send a message before asking the AI.' });
  }

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:' + PORT,
        'X-Title': 'AI Bot'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are AI Bot, a helpful, clear, friendly assistant. Give accurate answers, explain uncertainty, and format code in fenced code blocks. Do not claim to have used tools or accessed information you have not actually accessed.' },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 1200
      }),
      signal: AbortSignal.timeout(60000)
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const detail = data?.error?.message || 'AI provider returned HTTP ' + upstream.status;
      const safeDetail = upstream.status === 401 ? 'The AI provider rejected the API key. Check the server environment variable.' :
        upstream.status === 402 ? 'The AI provider account has no available credits. Check your provider limits.' :
        upstream.status === 429 ? 'The AI provider is rate-limiting requests. Wait a moment and try again.' :
        upstream.status >= 500 ? 'The AI provider is temporarily unavailable. Try again shortly.' : detail;
      return send(res, upstream.status === 429 ? 429 : 502, { error: safeDetail });
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) return send(res, 502, { error: 'The AI provider returned no text.' });
    return send(res, 200, { reply: reply.trim(), model: data.model || MODEL });
  } catch (err) {
    const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
    return send(res, timedOut ? 504 : 502, { error: timedOut ? 'The AI request timed out. Please try again.' : 'Could not reach the AI provider from the server.' });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/api/chat') return handleChat(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed.' });
  const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.resolve(ROOT, '.' + pathname);
  if (!filePath.startsWith(ROOT + path.sep)) return send(res, 403, { error: 'Forbidden.' });
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    const type = ext === '.html' ? 'text/html; charset=utf-8' :
      ext === '.css' ? 'text/css; charset=utf-8' :
      ext === '.js' ? 'text/javascript; charset=utf-8' :
      ext === '.svg' ? 'image/svg+xml' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('AI Bot listening on port ' + PORT);
  if (!API_KEY) console.log('Set OPENROUTER_API_KEY in the server environment to enable AI replies.');
});
