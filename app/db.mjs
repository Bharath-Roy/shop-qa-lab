import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { scryptSync, randomBytes } from 'node:crypto';

export function passwordHash(password, salt) {
  return scryptSync(password, salt, 32).toString('hex');
}

export function openDatabase(filename) {
  mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, salt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price_cents INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cart (
      user_id INTEGER REFERENCES users(id), product_id INTEGER REFERENCES products(id),
      quantity INTEGER NOT NULL, PRIMARY KEY(user_id, product_id)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id),
      request_key TEXT NOT NULL, total_cents INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS order_items (
      order_id INTEGER REFERENCES orders(id), product_id INTEGER REFERENCES products(id),
      quantity INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL
    );
  `);
  const insert = db.prepare('INSERT OR IGNORE INTO products VALUES (?, ?, ?, ?)');
  insert.run(1, 'Desk notebook', 'Stationery', 12900);
  insert.run(2, 'Steel bottle', 'Everyday', 34900);
  insert.run(3, 'Cotton tote', 'Everyday', 19900);
  for (const email of ['asha@example.com', 'ravi@example.com']) {
    const salt = randomBytes(16).toString('hex');
    db.prepare('INSERT OR IGNORE INTO users(email, password_hash, salt) VALUES (?, ?, ?)')
      .run(email, passwordHash('practice123', salt), salt);
  }
  return db;
}
