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
    const { writePrintWindow } = await server.ssrLoadModule('/src/lib/pdf.ts')
    const data = {
      month: '2026-10', company: '<Empresa>', project: 'Projeto A', island: '<Ilha A>', area: 'Segurança', form: 'Padrão',
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
    assert.match(report.content, /Ilha: &lt;Ilha A&gt;/)
    assert.match(report.content, /84,90%/)
    assert.match(report.content, /Risco ponderado<\/span><strong>7,6/)
    assert.match(report.content, /Baixa <strong>60%/)
    assert.match(report.content, /Média <strong>30%/)
    assert.match(report.content, /Alta <strong>10%/)
    assert.match(report.content, /Outros \(2\)/)
    assert.match(report.content, /Categoria: Categoria 1/)
    assert.match(report.content, /Item A/)
    assert.doesNotMatch(report.content, /TRIF|HHT|IPF/)
    const options = { language: 'en', colors: {
      low: '#112233', medium: '#445566', high: '#778899', categories: '#abcdef', items: '#123456',
    } }
    const english = monthlyClosePdf({ ...data, company: null, project: null, island: null, selectedCategory: null }, options)
    assert.match(english.title, /Monthly close - October 2026/)
    assert.match(english.content, /Company: All companies · Project \/ site: All projects/)
    assert.match(english.content, /Island: All islands/)
    assert.match(english.content, /Average IDS<\/span><strong>84\.90%/)
    assert.match(english.content, /Weighted risk<\/span><strong>7\.6/)
    assert.match(english.content, /Low <strong>60%/)
    assert.match(english.content, /Medium <strong>30%/)
    assert.match(english.content, /High <strong>10%/)
    assert.match(english.content, /Other \(2\)/)
    assert.match(english.content, /Category: No category/)
    assert.match(english.content, /Categoria 1/)
    for (const color of Object.values(options.colors)) assert.ok(english.content.includes(color))
    let printedDocument = ''
    const printWindow = { document: {
      open() {}, write(html) { printedDocument = html }, close() {},
    } }
    writePrintWindow(printWindow, english.title, english.content, 'en')
    assert.match(printedDocument, /<html lang="en">/)
    writePrintWindow(printWindow, report.title, report.content)
    assert.match(printedDocument, /<html lang="pt-BR">/)
    const englishEmpty = monthlyClosePdf({ ...data, severity: [], categories: [], items: [] }, options)
    assert.match(englishEmpty.content, /No deviations with recorded severity/)
    assert.equal((englishEmpty.content.match(/No data in this scope/g) ?? []).length, 2)
    const empty = monthlyClosePdf({ ...data, ids: null, severity: [], categories: [], items: [] })
    assert.match(empty.content, /IDS médio<\/span><strong>—/)
    assert.match(empty.content, /Sem desvios com severidade informada/)
    assert.equal((empty.content.match(/Sem dados neste recorte/g) ?? []).length, 2)
  } finally {
    await server.close()
  }
})
