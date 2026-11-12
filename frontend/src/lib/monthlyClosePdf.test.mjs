import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

test('builds a 16:9 presentation summary from the selected data without inventing metrics', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  try {
    const { monthlyClosePdf } = await server.ssrLoadModule('/src/lib/monthlyClosePdf.ts')
    const data = {
      month: '2026-10', company: '<Empresa>', project: 'Projeto A', area: 'Segurança', form: 'Padrão',
      ids: 0.849, evaluations: 2, observedPeople: 12, deviations: 10, weightedDeviation: 7.6,
      severity: [{ name: 'Baixa', quantity: 6 }, { name: 'Média', quantity: 3 }, { name: 'Alta', quantity: 1 }],
      categories: Array.from({ length: 7 }, (_, index) => ({ name: `Categoria ${index + 1}`, quantity: 7 - index })),
      selectedCategory: 'Categoria 1',
      items: [{ name: 'Item A', quantity: 4 }, { name: 'Item B', quantity: 1 }],
    }
    const report = monthlyClosePdf(data)
    assert.match(report.content, /@page \{ size: 320mm 180mm; margin: 0; \}/)
    assert.match(report.content, /&lt;Empresa&gt;/)
    assert.doesNotMatch(report.content, /<Empresa>/)
    assert.match(report.content, /Projeto A/)
    assert.match(report.content, /84,90%/)
    assert.match(report.content, /Risco ponderado<\/span><strong>7,6/)
    assert.match(report.content, /Baixa <strong>60%/)
    assert.match(report.content, /Média <strong>30%/)
    assert.match(report.content, /Alta <strong>10%/)
    assert.match(report.content, /Outros \(2\)/)
    assert.match(report.content, /Categoria: Categoria 1/)
    assert.match(report.content, /Item A/)
    assert.doesNotMatch(report.content, /TRIF|HHT|IPF/)
    const empty = monthlyClosePdf({ ...data, ids: null, severity: [], categories: [], items: [] })
    assert.match(empty.content, /IDS médio<\/span><strong>—/)
    assert.match(empty.content, /Sem desvios com severidade informada/)
    assert.equal((empty.content.match(/Sem dados neste recorte/g) ?? []).length, 2)
  } finally {
    await server.close()
  }
})
