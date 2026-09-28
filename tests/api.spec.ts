import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { addItem, checkout, signIn } from './helpers.js';

test('catalog search and category apply together', async ({ request }) => {
  const response = await request.get('/api/products?search=STEEL&category=Everyday');
  expect(response.status()).toBe(200);
  expect((await response.json()).map((p: { name: string }) => p.name)).toEqual(['Steel bottle']);
  expect(await (await request.get('/api/products?search=steel&category=Stationery')).json()).toEqual([]);
});

test('anonymous users cannot read a cart or checkout', async ({ request }) => {
  expect((await request.get('/api/cart')).status()).toBe(401);
  expect((await checkout(request)).status()).toBe(401);
});

test('wrong password does not create a session', async ({ request }) => {
  expect((await request.post('/api/login', { data: { email: 'asha@example.com', password: 'wrong' } })).status()).toBe(401);
  expect((await request.get('/api/me')).status()).toBe(401);
});

test('signing out invalidates the session on the server', async ({ request, playwright, baseURL }) => {
  await signIn(request);
  const before = await request.storageState();
  expect((await request.post('/api/logout')).status()).toBe(200);
  const oldSession = await playwright.request.newContext({ baseURL, storageState: before });
  try { expect((await oldSession.get('/api/cart')).status()).toBe(401); }
  finally { await oldSession.dispose(); }
});

for (const quantity of [0, -1, 11, 1.5, '2', null]) {
  test(`invalid quantity ${JSON.stringify(quantity)} leaves the cart unchanged`, async ({ request }) => {
    await signIn(request);
    await addItem(request, 1, 2);
    const response = await request.post('/api/cart', { data: { product_id: 1, quantity } });
    expect(response.status()).toBe(400);
    expect((await (await request.get('/api/cart')).json()).items[0].quantity).toBe(2);
  });
}

test('quantity boundaries and removing items recalculate the total', async ({ request }) => {
  await signIn(request);
  expect((await addItem(request, 1, 10)).total_cents).toBe(129000);
  expect((await addItem(request, 1, 1)).total_cents).toBe(12900);
  await addItem(request, 2, 1);
  const response = await request.delete('/api/cart/1');
  expect(await response.json()).toMatchObject({ total_cents: 34900, items: [{ id: 2, quantity: 1 }] });
});

test('unknown products and empty carts cannot create orders', async ({ request }) => {
  await signIn(request);
  expect((await request.post('/api/cart', { data: { product_id: 9999, quantity: 1 } })).status()).toBe(404);
  expect((await checkout(request)).status()).toBe(400);
});

test('cart state is isolated between customers', async ({ request, playwright, baseURL }) => {
  await signIn(request);
  await addItem(request, 1, 3);
  const other = await playwright.request.newContext({ baseURL });
  try {
    await signIn(other);
    expect(await (await other.get('/api/cart')).json()).toEqual({ items: [], total_cents: 0 });
  } finally { await other.dispose(); }
});

test('saved order rows agree with the API and independent arithmetic', async ({ request }) => {
  await signIn(request);
  await addItem(request, 1, 2);
  await addItem(request, 2, 1);
  const response = await checkout(request);
  expect(response.status()).toBe(201);
  const order = await response.json();
  expect(order.total_cents).toBe(60700); // 2 × 129 + 349 rupees; not calculated from the response.
  const db = new DatabaseSync(process.env.DB_PATH!, { readOnly: true });
  try {
    const saved = db.prepare('SELECT total_cents FROM orders WHERE id = ?').get(order.id);
    const lineSum = db.prepare('SELECT SUM(quantity * unit_price_cents) AS total FROM order_items WHERE order_id = ?').get(order.id);
    expect(saved?.total_cents).toBe(60700);
    expect(lineSum?.total).toBe(60700);
  } finally { db.close(); }
  expect((await (await request.get('/api/cart')).json()).items).toEqual([]);
});

test('invalid JSON returns a client error and the server stays healthy', async ({ request }) => {
  await signIn(request);
  expect((await request.post('/api/cart', { data: '{', headers: { 'Content-Type': 'application/json' } })).status()).toBe(400);
  expect((await request.get('/health')).status()).toBe(200);
});
