import { test, expect } from '@playwright/test';
import { signIn } from './helpers.js';

test('customer signs in and buys two notebooks', async ({ page, request }) => {
  const credentials = await signIn(request);
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(`Signed in as ${credentials.email}`)).toBeVisible();
  const notebook = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Desk notebook' }) });
  await notebook.getByLabel('Quantity for Desk notebook').fill('2');
  await notebook.getByRole('button', { name: 'Add to cart' }).click();
  const cart = page.getByRole('complementary', { name: 'Your cart' });
  await expect(cart.getByText('Desk notebook × 2')).toBeVisible();
  await expect(cart.locator('#cart-total')).toHaveText('₹258.00');
  const saved = page.waitForResponse(r => r.url().endsWith('/api/orders') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Place order' }).click();
  const response = await saved;
  expect(response.status()).toBe(201);
  expect((await response.json()).total_cents).toBe(25800);
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
  await expect(cart.getByText(/Order #\d+ · ₹258.00/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Place order' })).toBeDisabled();
});

test('filters can return one item or an empty result', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Search products').fill('steel');
  await page.getByLabel('Category', { exact: true }).selectOption('Everyday');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Steel bottle' })).toBeVisible();
  await page.getByLabel('Category', { exact: true }).selectOption('Stationery');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByText('No products match those filters.')).toBeVisible();
});

test('a failed checkout keeps the cart and allows a retry', async ({ page }) => {
  await signIn(page.request);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.getByRole('article').filter({ hasText: 'Cotton tote' }).getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText('Cotton tote × 1')).toBeVisible();
  await page.route('**/api/orders', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Checkout unavailable. Please retry.' }) }), { times: 1 });
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('status')).toHaveText('Checkout unavailable. Please retry.');
  await expect(page.getByText('Cotton tote × 1')).toBeVisible();
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
});

test('mobile layout supports adding and removing a product', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page.request);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.getByRole('article').filter({ hasText: 'Steel bottle' }).getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText('Steel bottle × 1')).toBeVisible();
  await page.getByRole('button', { name: 'Remove Steel bottle' }).click();
  await expect(page.getByRole('button', { name: 'Place order' })).toBeDisabled();
  await expect(page.getByText('Your cart is empty.', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/mobile-shop.png', fullPage: true });
});
