# Test strategy

## Question
Can a customer complete a purchase without an incorrect total, another customer's order being exposed, or a checkout retry causing a second purchase?

## Requirements used as the test oracle

| Rule | Expected behaviour | Coverage |
| --- | --- | --- |
| Authentication | Cart and order APIs require a valid session; logout revokes it | API tests |
| Quantity | Whole numbers 1–10 inclusive; updates replace the quantity | API boundary cases |
| Pricing | Notebook ₹129, bottle ₹349, tote ₹199; no tax or shipping | API, SQL and checkout UI |
| Isolation | Each customer has their own cart; inaccessible orders return 404 | API and ownership regression |
| Checkout | A non-empty cart creates an order and is cleared | API, SQL and browser |
| Retry | A customer/request-key pair identifies one order, even if the cart later changes | Duplicate-order regression |
| Failure recovery | A 503 response leaves the cart visible and lets the customer retry | Browser route simulation |
| Search | Search ignores case; category and search both apply | API and browser |

The three deliberately faulty server modes violate these rules. The tests do not change their expected answers when a defect is enabled.

## Priorities

Customer isolation and incorrect orders come first because they could expose information or create financial confusion in a real shop. Search and layout come afterward. The demo does not take payments, so this is a prioritisation exercise, not a statement of real customer impact.

## Manual exploration

1. Sign in as each demo customer and check cart persistence after signing out and back in.
2. Change quantity to 0, 1, 10, 11 and a decimal. Explain why server-side validation is needed even when the input has min/max attributes.
3. Add two different items, remove one and recalculate the total yourself.
4. Use the page with the keyboard; check focus visibility and status messages.
5. In browser network tools, inspect a checkout request, response and subsequent cart request.

Record environment, exact steps, expected/actual behaviour and evidence for any finding. These manual tasks are a checklist, not a claim that they have all been completed.

## Limits

No real payment gateway, stock reservation, refund flow, shipping or tax. No load test, full accessibility audit or security audit. No Firefox/WebKit run. A viewport test does not establish real mobile-device coverage. The API uses local sessions and has no production rate limiting or account recovery.
