const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const dataFile = path.join(root, 'data', 'materials.json');
const adminUser = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
const sessions = new Map();
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

fs.mkdirSync(path.dirname(dataFile), { recursive: true });
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, '[]', 'utf8');
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error('Request too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); }
    });
  });
}

function cookieToken(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function isAuthenticated(req) {
  return sessions.has(cookieToken(req));
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  return resolved.startsWith(root + path.sep) ? resolved : null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    try {
      const credentials = await readJson(req);
      if (credentials.username === adminUser && credentials.password === adminPassword) {
        const token = crypto.randomBytes(32).toString('hex');
        sessions.set(token, Date.now());
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': `admin_session=${token}; HttpOnly; SameSite=Strict; Path=/`
        });
        res.end(JSON.stringify({ ok: true }));
      } else {
        send(res, 401, { error: 'بيانات الدخول غير صحيحة' });
      }
    } catch (error) {
      send(res, 400, { error: 'طلب غير صالح' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/logout') {
    sessions.delete(cookieToken(req));
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': 'admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
    });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/session') {
    send(res, 200, { authenticated: isAuthenticated(req) });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/materials') {
    try {
      send(res, 200, JSON.parse(fs.readFileSync(dataFile, 'utf8')));
    } catch (error) {
      send(res, 500, { error: 'تعذر قراءة الخامات' });
    }
    return;
  }

  if (req.method === 'PUT' && url.pathname === '/api/materials') {
    if (!isAuthenticated(req)) {
      send(res, 401, { error: 'يجب تسجيل دخول الأدمن' });
      return;
    }
    try {
      const materials = await readJson(req);
      if (!Array.isArray(materials)) throw new Error('Invalid materials');
      fs.writeFileSync(dataFile, JSON.stringify(materials, null, 2), 'utf8');
      send(res, 200, { ok: true });
    } catch (error) {
      send(res, 400, { error: 'تعذر حفظ الخامات' });
    }
    return;
  }

  const filePath = safePath(url.pathname);
  if (!filePath) {
    send(res, 403, 'Forbidden', 'text/plain');
    return;
  }
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      send(res, 404, 'Not found', 'text/plain');
      return;
    }
    const type = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(filePath).pipe(res);
  });
});

const port = Number(process.env.PORT) || 4173;
server.listen(port, () => console.log(`Catalog running at http://localhost:${port}`));
