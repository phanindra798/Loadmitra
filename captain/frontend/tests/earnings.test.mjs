import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/features/captain/earnings.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { captainPayout } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
test('client payout components add up to the displayed total across all load modes', () => {
  for (const mode of ['full', 'shared', 'return']) for (const fare of [0, 1, 9, 10, 2050, 2050.49, 2222.7, 99999]) {
    const payout = captainPayout(fare, mode, 100);
    assert.equal(payout.net, payout.fare - payout.commission + payout.incentive);
    assert.equal(payout.perKm, Math.round(payout.net / 100 * 10) / 10);
  }
});
test('known rounding boundaries match the server payout policy', () => {
  assert.equal(captainPayout(2050, 'full', 100).net, 1742);
  assert.equal(captainPayout(2050, 'return', 100).net, 1865);
  assert.equal(captainPayout(2050, 'shared', 100).net, 1824);
  assert.equal(captainPayout(0, 'full', 0).perKm, 0);
});
