# Initial verification

The local suite passed all 22 tests on Node 24.21.0 and Node 26.8.2, using Playwright 1.63.0 on Linux ARM64. TypeScript checking passed. The controlled defect experiment also passed on Node 24: three clean baselines passed, and all three enabled defects failed at their intended assertion.

See [verification.json](../evidence/verification.json) for the recorded test names and statuses, and [mobile screenshot](../evidence/mobile-shop.png) for the browser viewport check.

The record covers test/app commit `3049242`. Documentation and workflow files were added afterward. The GitHub Actions workflow has been checked locally for YAML syntax, but it has not run on GitHub. Passing local checks is not a hosted CI result.

## Assessment

The baseline is suitable for this limited local demonstration. No claim is made about production readiness, real payments, load handling, security certification or complete browser coverage. Each seeded-defect mode should be rejected by the matching regression.

## Repeat the checks

```sh
npm ci
npx playwright install chromium
npm run typecheck
npm test
npm run test:bugs
```
