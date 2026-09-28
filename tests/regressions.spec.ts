import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { addItem, checkout, signIn } from './helpers.js';

test('order total includes every quantity @total', async ({ request }) => {
  await signIn(request);
  await addItem(request, 1, 3);
  const response = await checkout(request);
  expect(response.status()).toBe(201);
  expect((await response.json()).total_cents, 'TOTAL_REGRESSION').toBe(38700);
});

test('another customer cannot read an order @owner', async ({ request, playwright, baseURL }) => {
  await signIn(request);
  await addItem(request);
  const created = await checkout(request);
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const other = await playwright.request.newContext({ baseURL });
  try {
    await signIn(other);
    const response = await other.get(`/api/orders/${id}`);
    expect(response.status(), 'OWNER_REGRESSION').toBe(404);
    expect(await response.json()).toEqual({ error: 'Order not found' });
  } finally { await other.dispose(); }
});

test('replaying a checkout does not purchase a later cart @duplicate', async ({ request }) => {
  await signIn(request);
  await addItem(request);
  const key = randomUUID();
  const first = await checkout(request, key);
  expect(first.status()).toBe(201);
  const original = await first.json();
  await addItem(request, 2, 2);
  const replay = await checkout(request, key);
  expect(replay.status(), 'DUPLICATE_REGRESSION').toBe(200);
  expect((await replay.json()).id).toBe(original.id);
  const db = new DatabaseSync(process.env.DB_PATH!, { readOnly: true });
  try {
    expect(db.prepare('SELECT COUNT(*) AS count FROM orders WHERE user_id = ? AND request_key = ?').get(original.user_id, key)?.count).toBe(1);
  } finally { db.close(); }
  expect((await (await request.get('/api/cart')).json()).total_cents).toBe(69800);
});
