import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('formats IDS and IPF in printable reports without changing other precision', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    configFile: false,
    server: { middlewareMode: true },
    appType: 'custom',
  })
  try {
    const { evaluationPdf, ipfReportPdf, monthlyIpfReportPdf, ipfCompositionPdf } =
      await server.ssrLoadModule('/src/lib/pdf.ts')
    const { IndicatorResult } = await server.ssrLoadModule('/src/components/IndicatorResult.tsx')
    const display = (kind, value) => renderToStaticMarkup(createElement(IndicatorResult, { kind, value }))
    assert.match(display('ids', 0.849999), /color:#c62828.*85,00%.*Não atingiu a meta/)
    assert.match(display('ids', 0.85), /color:#18743a.*85,00%.*Meta alcançada/)
    assert.match(display('ipf', 6.9999), /color:#c62828.*7,0.*Não atingiu a meta/)
    assert.match(display('ipf', 7), /color:#18743a.*7,0.*Meta alcançada/)
    assert.doesNotMatch(display('ids', null), /Meta alcançada|Não atingiu a meta|color:/)
    const evaluation = evaluationPdf({
      evaluationDate: '2026-01-15', observations: [], indicators: {
        ids: 0.8, observedPeople: 1, totalDeviations: 0, weightedDeviationTotal: 0,
      },
    })
    assert.match(evaluation.content, /<span style="color:#c62828">80,00% · Não atingiu a meta<\/span>/)

    const history = ipfReportPdf({
      year: 2026, contractor: 'Empresa', annualAverage: 7,
      months: [{ month: 1, value: 7, updatedAtUtc: '2026-01-15T12:00:00Z' }],
    }, 2)
    assert.match(history.content, /class="number"><span style="color:#18743a">7,0 · Meta alcançada<\/span><\/td>/)
    assert.match(history.content, /Média dos meses informados<\/td><td><span style="color:#18743a">7,0 · Meta alcançada<\/span><\/td>/)
    assert.match(history.content, /class="number">—<\/td>/)

    const monthly = monthlyIpfReportPdf({
      year: 2026, month: 1, monthLabel: 'Janeiro', contractor: 'Empresa',
      issuedAt: '2026-01-15T12:00:00Z', ipfValue: 7.04, idsAverage: 0.8, charts: [],
    })
    assert.match(monthly.content, /<strong><span style="color:#18743a">7,0 · Meta alcançada<\/span><\/strong>/)
    assert.match(monthly.content, /<strong><span style="color:#c62828">80,00% · Não atingiu a meta<\/span><\/strong>/)

    const composition = ipfCompositionPdf({
      year: 2026, month: 1, contractor: 'Empresa', value: 0.8762,
      areas: [{ areaName: 'Área', average: 0.8762, weight: 12.3456,
        effectiveWeight: 100, contribution: 0.8762, status: 'included',
        scoredEvaluationCount: 1, evaluationCount: 1 }],
    })
    assert.match(composition.content, /IPF final<\/td><td><span style="color:#c62828">0,9 · Não atingiu a meta<\/span><\/td>/)
    assert.match(composition.content, /class="number"><span style="color:#18743a">0,88 · Meta alcançada<\/span><\/td>/)
    assert.match(composition.content, /class="number">12,3456%<\/td>/)
    assert.match(composition.content, /class="number">0,8762<\/td>/)
  } finally {
    await server.close()
  }
})
