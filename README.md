# Shop QA Lab

[GitHub Actions](https://github.com/Bharath-Roy/shop-qa-lab/actions/workflows/qa.yml)

A small local shop for practising UI testing, API testing and database checks. The interesting part is checking whether the tests detect a defect, rather than just getting a green run.

## Run the shop

Use Node.js 24 or newer.

```sh
npm ci
npm start
```

Open http://127.0.0.1:4173. Demo accounts: `asha@example.com` and `ravi@example.com`, both with password `practice123`.

The shop sells three items. It has sign-in, search, a cart and simulated checkout. There is no real payment, shipping, tax or stock reservation. Data is stored locally in `.data/shop.sqlite`.

## Run the tests

```sh
npx playwright install chromium
npm run typecheck
npm test
npm run test:bugs
npm run report
```

On supported Linux environments, use `npx playwright install --with-deps chromium` if browser system libraries are missing. CI installs these on Ubuntu. The tests start their own shop on port 4174, with a fresh SQLite file; they do not touch the interactive shop's data. The defect checks use port 4175.

There are 22 tests: 15 API/data checks, 3 targeted regressions and 4 browser flows. Chromium only; the mobile case uses a narrow viewport, not a real phone. Retries are off so unexpected failures remain visible.

`test:bugs` runs each targeted regression twice. The baseline must pass. With the matching defect enabled, it must fail at the expected assertion. A server startup error does not count as catching a defect. The command exits zero when all six outcomes match this contract.

| Switch | Deliberate defect | Expected detection |
| --- | --- | --- |
| `wrong-total` | Order total ignores quantity | 3 notebooks must cost ₹387, not ₹129 |
| `owner-check` | Order lookup ignores customer ownership | A second customer's request must return 404 |
| `duplicate-order` | An old checkout request buys a later cart | Same request key must return the original order |

For a manual exercise, stop the ordinary shop and run `APP_BUG=wrong-total npm start` on macOS/Linux. In PowerShell use `$env:APP_BUG='wrong-total'; npm start`, then clear it with `Remove-Item Env:APP_BUG` when finished. Switches are controlled only through the server environment.

## Read the evidence

- [Test strategy and boundaries](docs/test-strategy.md)
- [Three reproducible practice defect reports](docs/defects.md)
- [Verification record](docs/verification.md) and [machine-readable results](evidence/verification.json)
- [Walkthrough and next exercises](docs/walkthrough.md)

Runtime HTML reports, traces and screenshots are saved under `playwright-report/`, `test-results/` and `artifacts/`. They are ignored by Git. CI uploads them as a downloadable artifact. The files in `evidence/` are a small checked-in snapshot from an actual local run; rerun the commands for fresh results.

## A few choices

- Prices use integer paise, avoiding floating-point totals.
- Tests use fresh accounts and an independent database file. They can run with two workers.
- Expected totals are written from the requirements, not copied from the application response.
- SQLite checks verify saved records in addition to status codes and UI text.
- Browser flows use accessible labels and roles. No fixed sleeps.
- A small helper file is enough for this scope; there is no generic framework layer or page-object hierarchy.

Test SQLite files remain in `.data/` for inspection and can be removed after runs. `npm start` uses `.data/shop.sqlite`; deleting that file resets the interactive shop.

## About this project

This is an AI-assisted practice project, not client work. The app was built for this repository. The deliberately seeded defects are exercises, not discoveries in a production product. Commit dates reflect when this repository was created.

The app only listens on the local loopback address. It is a testing sandbox, not a production storefront.
