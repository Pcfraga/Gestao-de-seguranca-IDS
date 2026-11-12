import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatIds, formatIdsNumber, formatIpf } from './indicatorFormat.ts'

test('formats IDS and IPF with fixed decimal places without changing the input scale', () => {
  assert.equal(formatIds(0.8762), '87,62%')
  assert.equal(formatIds(0), '0,00%')
  assert.equal(formatIds(-0.125), '-12,50%')
  assert.equal(formatIdsNumber(0.8762), '0,88')
  assert.equal(formatIdsNumber(0), '0,00')
  assert.equal(formatIpf(7), '7,0')
  assert.equal(formatIpf(-1.26), '-1,3')
  assert.equal(formatIpf(0), '0,0')
  for (const format of [formatIds, formatIdsNumber, formatIpf]) {
    assert.equal(format(null), '—')
    assert.equal(format(undefined), '—')
    assert.equal(format(null, ''), '')
  }
})
