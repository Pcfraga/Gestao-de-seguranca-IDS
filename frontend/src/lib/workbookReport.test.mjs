import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildWorkbookCharts, workbookChartHtml, workbookChartSvg } from './workbookReport.ts'

function fixture() {
  const weekdays = [1, 2, 5].map((weekNumber, index) => ({
    weekNumber, dayOfWeek: index + 1, evaluationCount: 250,
    observedPeople: 1000, totalDeviations: 6,
    lowSeverityDeviations: 3, mediumSeverityDeviations: 1, highSeverityDeviations: 2,
  }))
  const weeklyIds = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Média']
    .map(label => ({ label, values: [0.8, null, null, null, 0], average: 0.4 }))
  return {
    year: 2026,
    ipfMonths: [{ month: 1, value: 8 }, { month: 2, value: 0 }],
    idsMonths: [{ month: 1, value: 0.8 }, { month: 2, value: 0 }],
    ipfValue: 8, ipfAverage: 4, idsAnnualAverage: 0.4, weeklyIds,
    data: {
      weekdays,
      weeklyCategories: [{ weekNumber: 1, code: 'epi', name: "Uso de EPI's", quantity: 6 }],
      weeklyItems: [{ weekNumber: 1, categoryCode: 'epi', category: "Uso de EPI's", code: 'epi_helmet', name: 'Capacete/Jugular', quantity: 6 }],
    },
  }
}

test('matches all 14 workbook charts in drawing-anchor order', () => {
  const charts = buildWorkbookCharts(fixture())
  assert.deepEqual(charts.map(chart => chart.title), [
    'Resultados do IPF', 'Resultados de IDS', 'IDS', 'Pessoas Observadas',
    'Desvios Registrados', 'Desvios por Grau de Severidade',
    'Desvios por Grau de Severidade (%)', 'Desvios por Categoria',
    'EPI', 'Posição das Pessoas', 'Ação Quando Observado',
    'Procedimentos', 'Ferramentas e Equipamentos', 'Padrões de Organização',
  ])
  assert.equal(new Set(charts.map(chart => chart.id)).size, 14)
  assert.deepEqual(charts.map(chart => chart.series.length), [1, 13, 7, 7, 7, 4, 3, 7, 10, 11, 5, 4, 4, 4])
  assert.equal(charts.filter(chart => chart.threeDimensional).length, 2)
  assert.notEqual(charts[2].stacked, true)
  for (const chart of charts) {
    for (const series of chart.series) assert.equal(series.values.length, chart.labels.length)
  }
})

test('retains twelve months, current-month and annual results without treating missing values as zero', () => {
  const [ipf, ids] = buildWorkbookCharts(fixture())
  assert.equal(ipf.labels.length, 14)
  assert.match(ipf.labels[0], /jan.*26/)
  assert.deepEqual(ipf.series[0].values.slice(0, 3), [8, 0, null])
  assert.deepEqual(ipf.series[0].values.slice(-2), [8, 4])
  assert.equal(ids.series.length, 13)
  assert.equal(ids.series[1].values[0], 0)
  assert.equal(ids.series[2].values[0], null)
  assert.equal(ids.series[12].values[0], 0.4)
})

test('uses a fixed IPF axis from zero to ten in increments of one', () => {
  const chart = buildWorkbookCharts(fixture())[0]
  for (const values of [[8, 0, null], [null, null], [-2, 12], [0, 10]]) {
    chart.series[0].values = [...values, ...Array(chart.labels.length - values.length).fill(null)]
    const svg = workbookChartSvg(chart)
    const gridLabels = [...svg.matchAll(/<text x="78" y="[^"]+" text-anchor="end" fill="#595959">([^<]+)<\/text>/g)]
      .map(match => match[1])
    assert.deepEqual(gridLabels, Array.from({ length: 11 }, (_, i) => `${i},0`))
    assert.equal((svg.match(/stroke="#D9D9D9"/g) ?? []).length, 11)
    assert.doesNotMatch(svg, /NaN|Infinity|height="-/)
  }
})

test('indicates IPF values outside the fixed scale without changing the displayed values', () => {
  const chart = buildWorkbookCharts(fixture())[0]
  chart.series[0].values[0] = -1.26
  chart.series[0].values[1] = 12.34
  const html = workbookChartHtml(chart)
  assert.match(html, />-1,3 ↓<\/text>/)
  assert.match(html, />12,3 ↑<\/text>/)
  assert.match(html, /Setas indicam valores fora da escala/)
  assert.match(html, /-1,3 · Não atingiu a meta/)
  assert.match(html, /12,3 · Meta alcançada/)
  assert.deepEqual(chart.series[0].values.slice(0, 2), [-1.26, 12.34])
})

test('uses a fixed IDS history axis from 0% to 100% with 20-point increments', () => {
  const chart = buildWorkbookCharts(fixture())[1]
  for (const values of [[0.8, 0, null], [null, null], [-0.2, 1.2], [0, 1]]) {
    chart.series.forEach((series, index) => { series.values[0] = values[index] ?? null })
    const svg = workbookChartSvg(chart)
    const gridLabels = [...svg.matchAll(/<text x="78" y="[^"]+" text-anchor="end" fill="#595959">([^<]+)<\/text>/g)]
      .map(match => match[1])
    assert.deepEqual(gridLabels, ['0,00%', '20,00%', '40,00%', '60,00%', '80,00%', '100,00%'])
    assert.equal((svg.match(/stroke="#D9D9D9"/g) ?? []).length, 6)
    assert.doesNotMatch(svg, /NaN|Infinity|height="-/)
  }
})

test('keeps real IDS history values and signals values outside the axis', () => {
  const chart = buildWorkbookCharts(fixture())[1]
  chart.series[0].values[0] = -0.126
  chart.series[1].values[0] = 1.234
  chart.series[2].values[0] = 0.8
  const html = workbookChartHtml(chart)
  assert.match(html, />↓<\/text>/)
  assert.match(html, />↑<\/text>/)
  assert.match(html, /Setas indicam valores fora da escala de 0% a 100%/)
  assert.match(html, /-12,60% · Não atingiu a meta/)
  assert.match(html, /123,40% · Meta alcançada/)
  assert.match(html, /80,00% · Não atingiu a meta/)
  assert.deepEqual(chart.series.slice(0, 3).map(series => series.values[0]), [-0.126, 1.234, 0.8])
})

test('plots weekly IDS series separately from zero instead of adding percentages', () => {
  const input = fixture()
  input.weeklyIds.forEach(row => { row.values = [null, null, null, null, null]; row.average = null })
  input.weeklyIds[1].values[1] = 0.8
  input.weeklyIds[3].values[1] = 0.75
  input.weeklyIds[6].values[1] = 0.775
  const chart = buildWorkbookCharts(input)[2]
  assert.deepEqual(chart.series.map(series => series.values[2]), [null, 0.8, null, 0.75, null, null, 0.775])
  const html = workbookChartHtml(chart)
  const ticks = [...html.matchAll(/<text x="78" y="[^"]+" text-anchor="end" fill="#595959">([^<]+)<\/text>/g)]
    .map(match => match[1])
  assert.deepEqual(ticks, ['0,00%', '20,00%', '40,00%', '60,00%', '80,00%', '100,00%'])
  const bars = [...html.matchAll(/<title>([^<]+ · S2: [^<]+)<\/title><rect x="([^"]+)" y="([^"]+)" width="[^"]+" height="([^"]+)"/g)]
  assert.equal(bars.length, 3)
  assert.deepEqual(bars.map(bar => bar[1]), [
    'terça · S2: 80,00% · Não atingiu a meta',
    'quinta · S2: 75,00% · Não atingiu a meta',
    'Média · S2: 77,50% · Não atingiu a meta',
  ])
  assert.equal(new Set(bars.map(bar => bar[2])).size, 3)
  for (const [index, value] of [0.8, 0.75, 0.775].entries()) {
    assert.ok(Math.abs(Number(bars[index][3]) - (270 - 245 * value)) < 1e-8)
    assert.ok(Math.abs(Number(bars[index][4]) - 245 * value) < 1e-8)
  }
  assert.match(html, /<td><span style="color:#c62828">77,50% · Não atingiu a meta<\/span><\/td>/)
})

test('signals out-of-range weekly IDS without changing values', () => {
  const chart = buildWorkbookCharts(fixture())[2]
  chart.series[0].values[1] = -0.5
  chart.series[1].values[1] = 1.2
  const html = workbookChartHtml(chart)
  assert.match(html, />↓<\/text>/)
  assert.match(html, />↑<\/text>/)
  assert.match(html, /-50,00% · Não atingiu a meta/)
  assert.match(html, /120,00% · Meta alcançada/)
  assert.match(html, /Setas indicam valores fora da escala de 0% a 100%/)
  assert.equal(chart.series[0].values[1], -0.5)
  assert.equal(chart.series[1].values[1], 1.2)
})

test('uses Office colors, workbook monthly overrides and dark blue category total', () => {
  const charts = buildWorkbookCharts(fixture())
  assert.deepEqual(charts[2].series.map(series => series.color), [
    '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#264478',
  ])
  assert.equal(charts[1].series[2].color, '#9C21C3')
  assert.equal(charts[1].series[3].color, '#BD2747')
  assert.equal(charts[7].series.at(-1).color, '#002060')
})

test('totals all consolidated evaluations and keeps S5 and six weekday series', () => {
  const charts = buildWorkbookCharts(fixture())
  assert.deepEqual(charts[3].labels, ['Total', 'S1', 'S2', 'S3', 'S4', 'S5'])
  assert.deepEqual(charts[3].series.at(-1).values, [3000, 1000, 1000, 0, 0, 1000])
  assert.deepEqual(charts[4].series.at(-1).values, [18, 6, 6, 0, 0, 6])
  assert.deepEqual(charts[5].series.at(-1).values, [6, 6, 0, 0, 6])
  assert.equal(charts[2].series[0].values[5], 0)
})

test('computes severity shares per week, leaving empty weeks unscored', () => {
  const chart = buildWorkbookCharts(fixture())[6]
  assert.equal(chart.maximum, 1)
  assert.deepEqual(chart.series.map(series => series.values[0]), [0.5, 1 / 6, 1 / 3])
  assert.deepEqual(chart.series.map(series => series.values[2]), [null, null, null])
})

test('preserves all 32 default items, zeros and additional versioned items', () => {
  const input = fixture()
  input.data.weeklyItems.push({
    weekNumber: 5, categoryCode: 'epi', category: "Uso de EPI's",
    code: 'custom-item', name: 'EPI adicional', quantity: 4,
  })
  const charts = buildWorkbookCharts(input)
  const epi = charts[8]
  assert.equal(charts.slice(8).reduce((sum, chart) => sum + chart.series.length - 1, 0), 33)
  assert.deepEqual(epi.series[0].values, [6, 0, 0, 0, 0])
  assert.deepEqual(epi.series.at(-1).values, [6, 0, 0, 0, 4])
  assert.equal(epi.series.at(-2).name, 'EPI adicional')
})

test('matches versioned checklist codes by names without losing custom categories', () => {
  const input = fixture()
  input.data.weeklyCategories = [
    { weekNumber: 1, code: 'version-epi', name: "Uso de EPI's", quantity: 2 },
    { weekNumber: 1, code: 'environment', name: 'Meio Ambiente', quantity: 7 },
  ]
  input.data.weeklyItems = [{
    weekNumber: 1, categoryCode: 'version-epi', category: "Uso de EPI's",
    code: 'version-helmet', name: 'Capacete/Jugular', quantity: 2,
  }]
  const charts = buildWorkbookCharts(input)
  assert.equal(charts[8].series[0].values[0], 2)
  assert.equal(charts[7].series.at(-2).name, 'Meio Ambiente')
  assert.equal(charts[7].series.at(-1).values[0], 9)
})

test('renders complete SVGs for empty, zero and negative IDS values without invalid coordinates', () => {
  const input = fixture()
  input.data.weekdays = []
  input.data.weeklyItems = []
  input.data.weeklyCategories = []
  input.weeklyIds[0].values[0] = -1.5
  for (const chart of buildWorkbookCharts(input)) {
    const svg = workbookChartSvg(chart)
    assert.match(svg, /<svg /)
    assert.match(svg, /viewBox="0 0 1000 /)
    assert.doesNotMatch(svg, /NaN|Infinity|height="-/)
  }
})

test('escapes user-supplied names consistently in SVG legends, titles and data tables', () => {
  const chart = buildWorkbookCharts(fixture())[8]
  chart.title = '<script>alert("title")</script>'
  chart.series[0].name = '<img src=x onerror=alert(1)>'
  const html = workbookChartHtml(chart)
  assert.doesNotMatch(html, /<script>|<img /)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /&lt;img /)
})

test('formats indicator values consistently in SVG titles, labels and data tables', () => {
  const charts = buildWorkbookCharts(fixture())
  const ipf = charts[0]
  ipf.series[0].values[0] = -1.26
  const ipfHtml = workbookChartHtml(ipf)
  assert.match(ipfHtml, /IPF · [^<]+: -1,3 · Não atingiu a meta<\/title>/)
  assert.match(ipfHtml, />-1,3 ↓<\/text>/)
  assert.match(ipfHtml, /<td><span style="color:#c62828">-1,3 · Não atingiu a meta<\/span><\/td><td><span style="color:#c62828">0,0 · Não atingiu a meta<\/span><\/td><td>—<\/td>/)

  const history = charts[1]
  history.series[0].values[0] = -0.126
  const historyHtml = workbookChartHtml(history)
  assert.match(historyHtml, /: -12,60% · Não atingiu a meta<\/title>/)
  assert.match(historyHtml, /<span style="color:#c62828">-12,60% · Não atingiu a meta<\/span>/)
  assert.match(historyHtml, /<span style="color:#c62828">0,00% · Não atingiu a meta<\/span>/)
  assert.match(historyHtml, /<td>—<\/td>/)

  const ids = charts[2]
  ids.series[0].values[0] = -0.126
  const idsHtml = workbookChartHtml(ids)
  assert.match(idsHtml, /: -12,60% · Não atingiu a meta<\/title>/)
  assert.match(idsHtml, /<span style="color:#c62828">-12,60% · Não atingiu a meta<\/span>/)
  assert.match(idsHtml, /<span style="color:#c62828">0,00% · Não atingiu a meta<\/span>/)
  assert.match(idsHtml, /<td>—<\/td>/)

  const severity = workbookChartHtml(charts[6])
  assert.match(severity, /<td>50%<\/td>/)
  assert.doesNotMatch(severity, /<td>50,00%<\/td>/)
})
