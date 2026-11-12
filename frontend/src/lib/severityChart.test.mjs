import assert from 'node:assert/strict'
import { test } from 'node:test'
import { severityWithPercentages } from './severityChart.ts'

test('shows each severity share using only deviations with informed severity', () => {
  const result = severityWithPercentages([
    { name: 'Baixa', quantity: 6 },
    { name: 'Média', quantity: 3 },
    { name: 'Alta', quantity: 1 },
  ])
  assert.deepEqual(result.map(item => item.percentageLabel), ['60%', '30%', '10%'])
  assert.deepEqual(result.map(item => item.quantity), [6, 3, 1])
})

test('preserves zero shares and recalculates after changing the filtered data', () => {
  const items = [{ name: 'Baixa', quantity: 1 }, { name: 'Média', quantity: 2 }, { name: 'Alta', quantity: 0 }]
  assert.deepEqual(severityWithPercentages(items).map(item => item.percentageLabel), [
    '33,3%', '66,7%', '0%',
  ])
  assert.deepEqual(severityWithPercentages(items.map(item => ({ ...item, quantity: 0 }))).map(item => item.percentageLabel), [
    '—', '—', '—',
  ])
})
