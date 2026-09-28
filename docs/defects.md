# Controlled defect reports

These are seeded practice defects, reproduced by the suite. They were not found in a client's system. Disable `APP_BUG` to get the baseline behaviour. Automated evidence is in `artifacts/defects/` after `npm run test:bugs`.

## QA-01: Saved order ignores item quantity

- **Training severity:** high; order values disagree with the cart.
- **Environment:** `APP_BUG=wrong-total`.
- **Steps:** sign in, add three notebooks, place an order, inspect the returned order total.
- **Expected:** `total_cents: 38700` (3 × ₹129).
- **Actual with switch:** `total_cents: 12900`.
- **Cause:** the seeded calculation adds unit prices without multiplying by quantity.
- **Regression:** `order total includes every quantity @total`.
- **Verification:** passes without the switch; fails at `TOTAL_REGRESSION` with it.

## QA-02: Another customer can read an order

- **Training severity:** high; customer order details cross an account boundary.
- **Environment:** `APP_BUG=owner-check`.
- **Steps:** customer A creates an order; customer B signs in using a separate session and requests `/api/orders/<A's order ID>`.
- **Expected:** 404 with no order details.
- **Actual with switch:** 200 and A's order data.
- **Cause:** the seeded lookup skips the ownership comparison.
- **Regression:** `another customer cannot read an order @owner`.
- **Verification:** passes normally; fails at `OWNER_REGRESSION` with the switch.

## QA-03: Replayed request purchases the customer's new cart

- **Training severity:** high; a retry can create an unwanted order.
- **Environment:** `APP_BUG=duplicate-order`.
- **Steps:** create an order with request key K; add two bottles to the now-empty cart; replay the old checkout request with K.
- **Expected:** 200 with the original order ID; one database row for the customer/key pair; the two bottles remain in the cart.
- **Actual with switch:** 201 with a new order, consuming the later cart.
- **Cause:** the seeded route bypasses the existing-request check.
- **Regression:** `replaying a checkout does not purchase a later cart @duplicate`.
- **Verification:** passes normally; fails at `DUPLICATE_REGRESSION` with the switch.

## Test setup finding

An early run of the main suite and defect suite shared Playwright's default output directory. One process removed another's trace files, causing ENOENT errors. Each defect run now uses its own output directory. This was a test setup problem, not a shop defect.
