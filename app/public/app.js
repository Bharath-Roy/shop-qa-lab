const $ = selector => document.querySelector(selector);
const money = cents => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(cents / 100);
let signedIn = false;
let checkoutKey;

async function api(path, method = 'GET', data) {
  const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}
function message(text) { $('#message').textContent = text; }
function account(email) {
  signedIn = !!email;
  $('#login-form').hidden = signedIn;
  $('#signed-in').hidden = !signedIn;
  $('#account-email').textContent = email ? `Signed in as ${email}` : '';
}
function showCart(basket) {
  const root = $('#cart');
  root.replaceChildren();
  if (!basket.items.length) root.textContent = 'Your cart is empty.';
  for (const item of basket.items) {
    const row = document.createElement('div');
    row.className = 'cart-row';
    const text = document.createElement('span');
    text.textContent = `${item.name} × ${item.quantity}`;
    const remove = document.createElement('button');
    remove.className = 'link';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${item.name}`);
    remove.onclick = async () => {
      try { showCart(await api(`/api/cart/${item.id}`, 'DELETE')); checkoutKey = undefined; }
      catch (err) { message(err.message); }
    };
    row.append(text, remove); root.append(row);
  }
  $('#cart-total').textContent = money(basket.total_cents);
  $('#checkout').disabled = !signedIn || !basket.items.length;
}
async function products(query = '') {
  const rows = await api(`/api/products${query}`);
  const root = $('#products'); root.replaceChildren();
  if (!rows.length) root.textContent = 'No products match those filters.';
  for (const product of rows) {
    const card = document.createElement('article');
    const title = document.createElement('h3'); title.textContent = product.name;
    const price = document.createElement('p'); price.className = 'price'; price.textContent = money(product.price_cents);
    const label = document.createElement('label'); label.textContent = 'Quantity';
    const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.max = '10'; input.value = '1';
    input.setAttribute('aria-label', `Quantity for ${product.name}`); label.append(input);
    const button = document.createElement('button'); button.textContent = 'Add to cart';
    button.onclick = async () => {
      try {
        showCart(await api('/api/cart', 'POST', { product_id: product.id, quantity: Number(input.value) }));
        checkoutKey = undefined; $('#confirmation').hidden = true;
        message(`${product.name} added to cart.`);
      } catch (err) { message(err.message); }
    };
    card.append(title, price, label, button); root.append(card);
  }
}
$('#login-form').onsubmit = async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  try { const result = await api('/api/login', 'POST', data); account(result.email); showCart(await api('/api/cart')); message('Signed in.'); }
  catch (err) { message(err.message); }
};
$('#logout').onclick = async () => {
  try { await api('/api/logout', 'POST'); account(null); checkoutKey = undefined; showCart({ items: [], total_cents: 0 }); $('#confirmation').hidden = true; message('Signed out.'); }
  catch (err) { message(err.message); }
};
$('#filter-form').onsubmit = event => {
  event.preventDefault();
  products('?' + new URLSearchParams(new FormData(event.target))).catch(err => message(err.message));
};
$('#checkout').onclick = async () => {
  $('#checkout').disabled = true;
  checkoutKey ??= crypto.randomUUID();
  try {
    const order = await api('/api/orders', 'POST', { request_key: checkoutKey });
    $('#order-details').textContent = `Order #${order.id} · ${money(order.total_cents)}`;
    $('#confirmation').hidden = false;
    showCart(await api('/api/cart')); checkoutKey = undefined; message('Order saved.');
  } catch (err) { message(err.message); $('#checkout').disabled = false; }
};
async function init() {
  await products();
  try { const user = await api('/api/me'); account(user.email); showCart(await api('/api/cart')); }
  catch { account(null); showCart({ items: [], total_cents: 0 }); }
}
init().catch(err => message(err.message));
