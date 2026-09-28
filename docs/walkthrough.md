# Walkthrough

## Three-minute demo

1. Open the shop and buy two notebooks. Explain the expected total before checking it.
2. Show the SQL assertion in `tests/api.spec.ts`: an HTTP 201 alone does not prove that the saved total is right.
3. Run `npm run test:bugs`. Open one generated JSON report and show the exact assertion that failed.
4. Explain why failures from an unavailable server would not count as catching a defect.
5. State the limits: this is a local practice app, no actual payments and Chromium-only coverage.

## Things to be able to explain

- Why fresh accounts are better than clearing one shared cart before every test.
- Why monetary values are stored as integers.
- Why an order-ownership test needs two independent sessions.
- Why the retry test adds a new cart between requests.
- What the mocked 503 browser test proves and what it does not prove.
- Why a green suite does not establish coverage of every behaviour.

## Next exercises

These are not implemented yet. Pick one and keep the resulting commits and notes.

1. Simulate a response lost after the server saves an order, then verify that retrying does not create another order.
2. Add a regression for a session that expires while the cart is open.
3. Add Firefox or WebKit coverage and investigate any differences.
4. Compare an AI-generated checkout test with the existing regression: deliberately break quantity handling and record which test detects it. Save actual generated code and actual results; do not assume the AI test will fail.
5. Explore the shop independently and write one new test from a finding.
