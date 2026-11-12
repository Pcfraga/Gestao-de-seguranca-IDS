import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultPdfOptions, parsePdfOptions } from './monthlyClosePdfOptions.ts'

test('round-trips language and individual color choices', () => {
  const options = { language: 'en', colors: { ...defaultPdfOptions.colors, low: '#001122', items: '#abcdef' } }
  assert.deepEqual(parsePdfOptions(JSON.stringify(options)), options)
})

test('rejects malformed or unsafe saved options', () => {
  for (const raw of ['bad', '{}', JSON.stringify({ ...defaultPdfOptions, language: 'fr' }),
    JSON.stringify({ ...defaultPdfOptions, colors: { ...defaultPdfOptions.colors, low: 'red; color: red' } }),
    JSON.stringify({ ...defaultPdfOptions, colors: {} })]) {
    assert.throws(() => parsePdfOptions(raw))
  }
})
