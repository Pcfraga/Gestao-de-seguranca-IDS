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
  assert.equal(charts[2].stacked, true)
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
