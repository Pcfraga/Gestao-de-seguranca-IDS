import assert from 'node:assert/strict'
import { test } from 'node:test'
import { indicatorColor, indicatorStatus } from './indicatorStatus.ts'

test('classifies exact, below and above thresholds using unrounded values', () => {
  for (const [kind, below, threshold, above] of [
    ['ids', 0.849999, 0.85, 0.850001],
    ['ipf', 6.9999, 7, 7.0001],
  ]) {
    assert.equal(indicatorStatus(kind, below), 'Não atingiu a meta')
    assert.equal(indicatorColor(kind, below), '#c62828')
    assert.equal(indicatorStatus(kind, threshold), 'Meta alcançada')
    assert.equal(indicatorStatus(kind, above), 'Meta alcançada')
    assert.equal(indicatorColor(kind, threshold), '#18743a')
    for (const value of [null, undefined, NaN, Infinity]) {
      assert.equal(indicatorStatus(kind, value), null)
      assert.equal(indicatorColor(kind, value), null)
    }
  }
  assert.equal(indicatorStatus('ipf', 0.99), 'Não atingiu a meta')
})
