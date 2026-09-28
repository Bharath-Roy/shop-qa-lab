import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const checks = [
  { bug: 'wrong-total', tag: '@total', marker: 'TOTAL_REGRESSION' },
  { bug: 'owner-check', tag: '@owner', marker: 'OWNER_REGRESSION' },
  { bug: 'duplicate-order', tag: '@duplicate', marker: 'DUPLICATE_REGRESSION' },
];
const summary = [];
mkdirSync('artifacts/defects', { recursive: true });

function specs(suites) { return suites.flatMap(s => [...(s.specs || []), ...specs(s.suites || [])]); }
for (const check of checks) {
  for (const enabled of [false, true]) {
    const label = `${check.bug}-${enabled ? 'enabled' : 'baseline'}`;
    const reportFile = resolve(`artifacts/defects/${label}.json`);
    rmSync(reportFile, { force: true });
    const run = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', 'tests/regressions.spec.ts', '--grep', check.tag, '--reporter=json'], {
      env: { ...process.env, APP_BUG: enabled ? check.bug : '', PORT: '4175', PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile, QA_OUTPUT_DIR: `artifacts/defects/${label}-traces` },
      encoding: 'utf8', timeout: 60_000,
    });
    writeFileSync(`artifacts/defects/${label}.log`, `${run.stdout || ''}\n${run.stderr || ''}`);
    let report;
    try { report = JSON.parse(readFileSync(reportFile, 'utf8')); }
    catch { throw new Error(`${label}: no valid test report; this is not evidence of defect detection`); }
    const results = specs(report.suites).flatMap(s => s.tests).flatMap(t => t.results);
    const result = results[0];
    const error = (result?.errors || []).map(e => e.message || '').join('\n').replace(/\u001b\[[0-9;]*m/g, '');
    const valid = !run.error && !(report.errors || []).length && results.length === 1 &&
      (enabled ? run.status === 1 && result.status === 'failed' && error.includes(check.marker)
        : run.status === 0 && result.status === 'passed');
    summary.push({ defect: check.bug, mode: enabled ? 'defect enabled' : 'baseline', status: result?.status, valid, assertion: error || null });
    console.log(`${valid ? 'OK' : 'ERROR'} ${label}: ${result?.status}`);
    if (!valid) {
      writeFileSync('artifacts/defects/summary.json', JSON.stringify(summary, null, 2));
      throw new Error(`${label}: unexpected outcome; see artifacts/defects`);
    }
  }
}
writeFileSync('artifacts/defects/summary.json', JSON.stringify({ generated_at: new Date().toISOString(), note: 'Controlled training defects, not production discoveries.', results: summary }, null, 2));
console.log('All three regressions passed normally and detected their matching defect.');
