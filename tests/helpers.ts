import { expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Each test gets its own account; no shared cart or order cleanup is needed.
export async function signIn(api: APIRequestContext) {
  const credentials = { email: `test-${randomUUID()}@example.com`, password: 'practice123' };
  expect((await api.post('/api/register', { data: credentials })).status()).toBe(201);
  expect((await api.post('/api/login', { data: credentials })).status()).toBe(200);
  return credentials;
}

export async function addItem(api: APIRequestContext, product_id = 1, quantity = 1) {
  const response = await api.post('/api/cart', { data: { product_id, quantity } });
  expect(response.status()).toBe(200);
  return response.json();
}

export async function checkout(api: APIRequestContext, key = randomUUID()) {
  return api.post('/api/orders', { data: { request_key: key } });
}
