import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateMonthlyIpf } from './monthlyIpf.ts'

test('applies the exact user formula using IDS as a percentage', () => {
  assert.equal(calculateMonthlyIpf(0.8831, '0.8', '20'), 6.2389)
})

test('recalculates each editable operand without changing the order of operations', () => {
  assert.equal(calculateMonthlyIpf(0.8831, '1', '20'), 7.2986)
  assert.equal(calculateMonthlyIpf(0.8831, '0.8', '30'), 7.2389)
})

test('keeps real zero and negative averages, rounding only the final result', () => {
  assert.equal(calculateMonthlyIpf(0, '0.8', '20'), 2)
  assert.equal(calculateMonthlyIpf(0.8831, '0', '0'), 0)
  assert.equal(calculateMonthlyIpf(-0.8831, '0.8', '0'), -4.2389)
  assert.equal(calculateMonthlyIpf(1 / 3, '0.8', '20'), 3.6)
})

test('does not turn absent data or incomplete inputs into an IPF', () => {
  for (const [ids, factor, additional] of [
    [null, '0.8', '20'], [0.8831, '', '20'], [0.8831, '0.8', ' '],
    [NaN, '0.8', '20'], [0.8831, 'Infinity', '20'], [0.8831, 'invalid', '20'],
    [0.8831, '1e308', '20'],
  ]) {
    assert.equal(calculateMonthlyIpf(ids, factor, additional), null)
  }
})
