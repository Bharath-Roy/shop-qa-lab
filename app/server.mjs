import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { openDatabase, passwordHash } from './db.mjs';

const port = Number(process.env.PORT || 4173);
const db = openDatabase(process.env.DB_PATH || '.data/shop.sqlite');
const bugs = new Set((process.env.APP_BUG || '').split(',').filter(Boolean));
for (const bug of bugs) {
  if (!['wrong-total', 'owner-check', 'duplicate-order'].includes(bug)) {
    throw new Error(`Unknown practice defect: ${bug}`);
  }
}
const files = {
  '/': ['index.html', 'text/html'],
  '/app.js': ['app.js', 'text/javascript'],
  '/style.css': ['style.css', 'text/css'],
};

function send(res, status, value, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(value));
}

async function body(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 16_384) throw new Error('Request is too large');
  }
  const parsed = JSON.parse(data || '{}');
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Expected a JSON object');
  return parsed;
}

function session(req) {
  const token = (req.headers.cookie || '').split(';').map(s => s.trim())
    .find(s => s.startsWith('session='))?.slice(8);
  return db.prepare(`SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE token = ? AND expires_at > ?`).get(token || '', Date.now());
}

function cart(userId) {
  const items = db.prepare(`SELECT products.id, name, price_cents, quantity FROM cart
    JOIN products ON products.id = cart.product_id WHERE user_id = ? ORDER BY products.id`).all(userId);
  const total_cents = items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  return { items, total_cents };
}

function order(id) {
  const row = db.prepare('SELECT id, user_id, total_cents, created_at FROM orders WHERE id = ?').get(id);
  if (!row) return null;
  row.items = db.prepare(`SELECT product_id, quantity, unit_price_cents FROM order_items
    WHERE order_id = ? ORDER BY product_id`).all(id);
  return row;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const path = url.pathname;
  try {
    if (req.method === 'GET' && files[path]) {
      const [filename, type] = files[path];
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
      return res.end(readFileSync(new URL(`./public/${filename}`, import.meta.url)));
    }
    if (req.method === 'GET' && path === '/health') return send(res, 200, { status: 'ok', bugs: [...bugs] });
    if (req.method === 'GET' && path === '/api/products') {
      const search = url.searchParams.get('search') || '';
      const category = url.searchParams.get('category') || '';
      const rows = db.prepare(`SELECT * FROM products WHERE instr(lower(name), lower(?)) > 0
        AND (? = '' OR category = ?) ORDER BY id`).all(search, category, category);
      return send(res, 200, rows);
    }
    if (req.method === 'POST' && path === '/api/register') {
      const { email, password } = await body(req);
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          || typeof password !== 'string' || password.length < 8 || password.length > 128) {
        return send(res, 400, { error: 'Use a valid email and an 8–128 character password' });
      }
      const normalized = email.toLowerCase();
      if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalized)) return send(res, 409, { error: 'Email already registered' });
      const salt = randomBytes(16).toString('hex');
      db.prepare('INSERT INTO users(email, password_hash, salt) VALUES (?, ?, ?)')
        .run(normalized, passwordHash(password, salt), salt);
      return send(res, 201, { email: normalized });
    }
    if (req.method === 'POST' && path === '/api/login') {
      const { email, password } = await body(req);
      if (typeof email !== 'string' || typeof password !== 'string' || password.length > 128) return send(res, 400, { error: 'Email and password are required' });
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
      if (!user || !timingSafeEqual(Buffer.from(user.password_hash, 'hex'), Buffer.from(passwordHash(password, user.salt), 'hex'))) {
        return send(res, 401, { error: 'Email or password is incorrect' });
      }
      const token = randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(token, user.id, Date.now() + 3_600_000);
      return send(res, 200, { email: user.email }, { 'Set-Cookie': `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600` });
    }
    const user = session(req);
    if (!user) return send(res, 401, { error: 'Sign in to continue' });
    if (req.method === 'GET' && path === '/api/me') return send(res, 200, user);
    if (req.method === 'POST' && path === '/api/logout') {
      const token = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('session='))?.slice(8);
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      return send(res, 200, { ok: true }, { 'Set-Cookie': 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    }
    if (req.method === 'GET' && path === '/api/cart') return send(res, 200, cart(user.id));
    if (req.method === 'POST' && path === '/api/cart') {
      const { product_id, quantity } = await body(req);
      if (!Number.isInteger(product_id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        return send(res, 400, { error: 'Quantity must be a whole number from 1 to 10' });
      }
      if (!db.prepare('SELECT id FROM products WHERE id = ?').get(product_id)) return send(res, 404, { error: 'Product not found' });
      db.prepare(`INSERT INTO cart VALUES (?, ?, ?) ON CONFLICT(user_id, product_id)
        DO UPDATE SET quantity = excluded.quantity`).run(user.id, product_id, quantity);
      return send(res, 200, cart(user.id));
    }
    if (req.method === 'DELETE' && /^\/api\/cart\/\d+$/.test(path)) {
      db.prepare('DELETE FROM cart WHERE user_id = ? AND product_id = ?').run(user.id, Number(path.split('/').at(-1)));
      return send(res, 200, cart(user.id));
    }
    if (req.method === 'POST' && path === '/api/orders') {
      const { request_key } = await body(req);
      if (typeof request_key !== 'string' || request_key.length < 8 || request_key.length > 100) {
        return send(res, 400, { error: 'A request_key of 8–100 characters is required' });
      }
      // Deliberate practice defect: replaying a checkout creates another order.
      if (!bugs.has('duplicate-order')) {
        const previous = db.prepare('SELECT id FROM orders WHERE user_id = ? AND request_key = ?').get(user.id, request_key);
        if (previous) return send(res, 200, order(previous.id));
      }
      const basket = cart(user.id);
      if (!basket.items.length) return send(res, 400, { error: 'Your cart is empty' });
      // Deliberate practice defect: ignores quantities when saving the order total.
      const total = bugs.has('wrong-total') ? basket.items.reduce((n, i) => n + i.price_cents, 0) : basket.total_cents;
      db.exec('BEGIN IMMEDIATE');
      let id;
      try {
        id = Number(db.prepare('INSERT INTO orders(user_id, request_key, total_cents) VALUES (?, ?, ?)').run(user.id, request_key, total).lastInsertRowid);
        const insert = db.prepare('INSERT INTO order_items VALUES (?, ?, ?, ?)');
        for (const item of basket.items) insert.run(id, item.id, item.quantity, item.price_cents);
        db.prepare('DELETE FROM cart WHERE user_id = ?').run(user.id);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      return send(res, 201, order(id));
    }
    if (req.method === 'GET' && /^\/api\/orders\/\d+$/.test(path)) {
      const row = order(Number(path.split('/').at(-1)));
      // Return 404 for other customers' orders; do not reveal whether they exist.
      if (!row || (!bugs.has('owner-check') && row.user_id !== user.id)) return send(res, 404, { error: 'Order not found' });
      return send(res, 200, row);
    }
    return send(res, 404, { error: 'Route not found' });
  } catch (err) {
    if (err instanceof SyntaxError || ['Request is too large', 'Expected a JSON object'].includes(err.message)) {
      return send(res, 400, { error: 'Invalid JSON request' });
    }
    console.error(err);
    return send(res, 500, { error: 'Something went wrong' });
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Shop QA Lab: http://127.0.0.1:${port} (defects: ${[...bugs].join(', ') || 'none'})`));
process.on('SIGTERM', () => server.close(() => { db.close(); process.exit(0); }));
