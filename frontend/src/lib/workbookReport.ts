import type { DataConsolidation } from './api'
import { formatIds, formatIpf } from './indicatorFormat.ts'
import { indicatorColor, indicatorStatus, type IndicatorKind } from './indicatorStatus.ts'

export interface WorkbookChartSeries {
  name: string
  color: string
  values: Array<number | null>
}

export interface WorkbookChart {
  id: string
  title: string
  labels: string[]
  series: WorkbookChartSeries[]
  stacked?: boolean
  percentage?: boolean
  maximum?: number
  threeDimensional?: boolean
  legendRight?: boolean
  showValues?: boolean
}

interface WorkbookChartInput {
  year: number
  ipfMonths: Array<{ month: number; value: number | null }>
  idsMonths: Array<{ month: number; value: number | null }>
  ipfValue: number | null
  ipfAverage: number | null
  idsAnnualAverage: number | null
  weeklyIds: Array<{ label: string; values: Array<number | null>; average: number | null }>
  data: DataConsolidation
}

const officeColors = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47']

// Excel's lumMod changes HSL luminance, not individual RGB channels.
function luminance(color: string, factor: number, offset = 0) {
  const channels = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255)
  const minimum = Math.min(...channels)
  const maximum = Math.max(...channels)
  const lightness = (minimum + maximum) / 2
  const next = lightness * factor + offset
  const scale = (1 - Math.abs(2 * next - 1)) / (1 - Math.abs(2 * lightness - 1) || 1)
  return `#${channels.map(channel => Math.round(Math.max(0, Math.min(1, next + (channel - lightness) * scale)) * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

function seriesColor(index: number) {
  return luminance(officeColors[index % 6], index < 6 ? 1 : 0.6)
}

const workbookCategories = [
  { code: 'epi', name: 'EPI', items: [
    ['epi_helmet', 'Capacete/Jugular'], ['epi_respirator', 'Máscara Respiratória'],
    ['epi_glasses', 'Óculos'], ['epi_face_shield', 'Protetor Facial'],
    ['epi_hearing_protection', 'Protetor Auricular'], ['epi_gloves', 'Luvas'],
    ['epi_apron', 'Avental/jaleco'], ['epi_safety_footwear', 'Calçado de Segurança'],
    ['epi_harness', 'Cinto de Segurança'],
  ] },
  { code: 'people_position', name: 'Posição das Pessoas', items: [
    ['position_struck_by', 'Bater contra/Ser atingido por'], ['position_caught_in', 'Ficar preso'],
    ['position_fall', 'Risco de queda'], ['position_burn', 'Risco de queimadura'],
    ['position_electric_shock', 'Risco de choque elétrico'], ['position_contaminant', 'Inalar/Absorver contaminantes'],
    ['position_overlapping_work', 'Trabalho Sobreposto'], ['position_ingestion', 'Ingerir contaminantes'],
    ['position_posture', 'Postura inadequada'], ['position_effort', 'Esforço inadequado'],
  ] },
  { code: 'observed_action', name: 'Ação Quando Observado', items: [
    ['action_position_change', 'Mudança de posição'], ['action_stop', 'Paraliza a atividade'],
    ['action_adjust_ppe', 'Ajusta o EPI'], ['action_adjust_service', 'Adequa o serviço'],
  ] },
  { code: 'procedures', name: 'Procedimentos', items: [
    ['procedure_inadequate', 'Inadequados'], ['procedure_missing', 'Não existem procedimentos escritos'],
    ['procedure_not_followed', 'Adequados e não são seguidos'],
  ] },
  { code: 'tools_equipment', name: 'Ferramentas e Equipamentos', items: [
    ['tool_unsuitable', 'Impróprio para o serviço'], ['tool_misused', 'Usados incorretamente'],
    ['tool_unsafe', 'Em condição inseguras'],
  ] },
  { code: 'organization', name: 'Padrões de Organização', items: [
    ['organization_dirty', 'Local sujo/desorganizado'], ['organization_storage', 'Armazenamento inadequado'],
    ['organization_contamination', 'Contaminação Ambiental'],
  ] },
]

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g, '')
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null)
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

export function buildWorkbookCharts(input: WorkbookChartInput): WorkbookChart[] {
  const { data } = input
  const weeks = ['S1', 'S2', 'S3', 'S4', 'S5']
  const months = Array.from({ length: 12 }, (_, index) =>
    new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })
      .format(new Date(Date.UTC(input.year, index, 15))).replace('.', ''))
  const monthValues = (records: WorkbookChartInput['ipfMonths']) =>
    months.map((_, index) => records.find(record => record.month === index + 1)?.value ?? null)
  const severity = ['Baixo', 'Médio', 'Alto'].map((name, index) => ({
    name,
    color: seriesColor(index),
    values: weeks.map((_, week) => data.weekdays.filter(day => day.weekNumber === week + 1)
      .reduce((sum, day) => sum + [day.lowSeverityDeviations, day.mediumSeverityDeviations, day.highSeverityDeviations][index], 0)),
  }))
  const withTotal = (series: WorkbookChartSeries[], color = seriesColor(series.length)): WorkbookChartSeries[] => [
    ...series,
    { name: 'Total', color, values: weeks.map((_, week) => series.reduce((sum, row) => sum + (row.values[week] ?? 0), 0)) },
  ]
  const dailyMetric = (key: 'observedPeople' | 'totalDeviations') => {
    const series = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'].map((name, index) => {
      const values = weeks.map((_, week) => data.weekdays
        .filter(day => day.weekNumber === week + 1 && day.dayOfWeek === index + 1)
        .reduce((sum, day) => sum + day[key], 0))
      return { name, color: seriesColor(index), values: [values.reduce((sum, value) => sum + value, 0), ...values] }
    })
    return [...series, {
      name: 'Total', color: seriesColor(6),
      values: Array.from({ length: 6 }, (_, index) => series.reduce((sum, row) => sum + row.values[index], 0)),
    }]
  }
  const categories = workbookCategories.map(category => {
    const records = data.weeklyCategories.filter(row => row.code === category.code || normalize(row.name) === normalize(category.name)
      || category.code === 'epi' && normalize(row.name) === 'usodeepis')
    return {
      ...category,
      records,
      values: weeks.map((_, week) => records.filter(row => row.weekNumber === week + 1).reduce((sum, row) => sum + row.quantity, 0)),
    }
  })
  const categorySeries = categories.map((category, index) => ({ name: category.name, color: seriesColor(index), values: category.values }))
  const unmatchedCategories = data.weeklyCategories.filter(row => !categories.some(category => category.records.includes(row)))
  for (const code of new Set(unmatchedCategories.map(row => row.code))) {
    const rows = unmatchedCategories.filter(row => row.code === code)
    categorySeries.push({
      name: rows[0].name, color: seriesColor(categorySeries.length),
      values: weeks.map((_, week) => rows.filter(row => row.weekNumber === week + 1).reduce((sum, row) => sum + row.quantity, 0)),
    })
  }
  const itemCharts: WorkbookChart[] = categories.map(category => {
    const rows = data.weeklyItems.filter(row => row.categoryCode === category.code
      || category.records.some(record => record.code === row.categoryCode))
    const matched = new Set<DataConsolidation['weeklyItems'][number]>()
    const series = category.items.map(([code, name], index) => {
      const items = rows.filter(row => row.code === code || normalize(row.name) === normalize(name))
      items.forEach(item => matched.add(item))
      return { name, color: seriesColor(index), values: weeks.map((_, week) =>
        items.filter(row => row.weekNumber === week + 1).reduce((sum, row) => sum + row.quantity, 0)) }
    })
    for (const code of new Set(rows.filter(row => !matched.has(row)).map(row => row.code))) {
      const items = rows.filter(row => row.code === code && !matched.has(row))
      series.push({ name: items[0].name, color: seriesColor(series.length), values: weeks.map((_, week) =>
        items.filter(row => row.weekNumber === week + 1).reduce((sum, row) => sum + row.quantity, 0)) })
    }
    return { id: category.code, title: category.name, labels: weeks, series: withTotal(series) }
  })
  const idsColors = [luminance(officeColors[0], 0.75), '#ED7D31', '#9C21C3', '#BD2747', luminance(officeColors[3], 0.2, 0.8)]
  const idsValues = [...monthValues(input.idsMonths), input.idsAnnualAverage]
  return [
    {
      id: 'ipf', title: 'Resultados do IPF',
      labels: [...months, 'Resultado do Mês de Referência', 'Média Anual'],
      series: [{ name: 'IPF', color: officeColors[0], values: [...monthValues(input.ipfMonths), input.ipfValue, input.ipfAverage] }],
      threeDimensional: true, showValues: true,
    },
    {
      id: 'ids-history', title: 'Resultados de IDS', labels: [''],
      series: [...months, 'Média Anual'].map((name, index) => ({
        name, color: idsColors[index] ?? seriesColor(index), values: [idsValues[index]],
      })),
      threeDimensional: true, legendRight: true,
    },
    {
      id: 'ids', title: 'IDS', labels: ['Média', ...weeks], percentage: true,
      series: input.weeklyIds.map((row, index) => ({
        name: row.label === 'Média' ? 'Média' : row.label.toLocaleLowerCase('pt-BR'),
        color: seriesColor(index),
        values: [row.label === 'Média' ? average(row.values) : row.average, ...row.values],
      })),
    },
    { id: 'people', title: 'Pessoas Observadas', labels: ['Total', ...weeks], series: dailyMetric('observedPeople') },
    { id: 'deviations', title: 'Desvios Registrados', labels: ['Total', ...weeks], series: dailyMetric('totalDeviations') },
    { id: 'severity', title: 'Desvios por Grau de Severidade', labels: weeks, series: withTotal(severity) },
    {
      id: 'severity-share', title: 'Desvios por Grau de Severidade (%)', labels: weeks, percentage: true, maximum: 1,
      series: severity.map(row => ({
        ...row,
        values: row.values.map((value, week) => {
          const total = severity.reduce((sum, level) => sum + (level.values[week] ?? 0), 0)
          return total ? value / total : null
        }),
      })),
    },
    { id: 'categories', title: 'Desvios por Categoria', labels: weeks, series: withTotal(categorySeries, '#002060') },
    ...itemCharts,
  ]
}

export function escapeReportHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character)
}

function formatChartValue(chart: WorkbookChart, value: number | null) {
  if (chart.id === 'ipf') return formatIpf(value)
  if (chart.id === 'ids' || chart.id === 'ids-history') return formatIds(value)
  if (value === null) return '—'
  return chart.percentage
    ? `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
    : value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function chartIndicatorKind(chart: WorkbookChart): IndicatorKind | null {
  if (chart.id === 'ipf') return 'ipf'
  if (chart.id === 'ids' || chart.id === 'ids-history') return 'ids'
  return null
}

function chartResult(chart: WorkbookChart, value: number | null) {
  const formatted = formatChartValue(chart, value)
  const kind = chartIndicatorKind(chart)
  const status = kind ? indicatorStatus(kind, value) : null
  return status ? `${formatted} · ${status}` : formatted
}

export function workbookChartSvg(chart: WorkbookChart) {
  const width = 1000
  const plot = { x: 90, y: 25, width: chart.legendRight ? 680 : 870, height: 245 }
  const endY = plot.y + plot.height
  const values = chart.series.flatMap(series => series.values.filter((value): value is number => value !== null))
  const stacks = chart.labels.flatMap((_, index) => [
    chart.series.reduce((sum, row) => sum + Math.max(0, row.values[index] ?? 0), 0),
    chart.series.reduce((sum, row) => sum + Math.min(0, row.values[index] ?? 0), 0),
  ])
  const limits = chart.stacked ? stacks : values
  const rawMax = Math.max(chart.maximum ?? 0, ...limits, limits.some(value => value !== 0) ? 0 : 1)
  const rawMin = Math.min(...limits, 0)
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(rawMax - rawMin, 0.01)))
  const step = Math.ceil((rawMax - rawMin || 1) / magnitude / 5) * magnitude
  const fixedMaximum = chart.id === 'ipf' ? 10 : chart.id === 'ids-history' || chart.id === 'ids' ? 1 : null
  const maximum = fixedMaximum ?? chart.maximum ?? Math.max(step, Math.ceil(rawMax / step) * step)
  const minimum = fixedMaximum !== null ? 0 : Math.floor(rawMin / step) * step
  const y = (value: number) => endY - (value - minimum) / (maximum - minimum) * plot.height
  const format = (value: number) => formatChartValue(chart, value)
  const svg: string[] = []
  const divisions = chart.id === 'ipf' ? 10 : 5
  for (let index = 0; index <= divisions; index++) {
    const value = minimum + (maximum - minimum) * index / divisions
    svg.push(`<line x1="${plot.x}" x2="${plot.x + plot.width}" y1="${y(value)}" y2="${y(value)}" stroke="#D9D9D9"/>`,
      `<text x="${plot.x - 12}" y="${y(value) + 4}" text-anchor="end" fill="#595959">${format(value)}</text>`)
  }
  const groupWidth = plot.width / chart.labels.length
  chart.labels.forEach((label, index) => {
    const center = plot.x + groupWidth * (index + 0.5)
    const rotated = chart.labels.length > 10
    const displayed = label === 'Resultado do Mês de Referência' ? 'Mês de Referência' : label
    svg.push(`<text x="${center}" y="${endY + 22}" text-anchor="${rotated ? 'end' : 'middle'}"${rotated ? ` transform="rotate(-45 ${center} ${endY + 22})"` : ''} fill="#595959">${escapeReportHtml(displayed)}</text>`)
    let positive = 0
    let negative = 0
    const barWidth = groupWidth * 0.72 / (chart.stacked ? 1 : chart.series.length)
    chart.series.forEach((series, seriesIndex) => {
      const value = series.values[index]
      if (value === null || value === undefined) return
      const start = chart.stacked ? (value >= 0 ? positive : negative) : 0
      if (chart.stacked) {
        if (value >= 0) positive += value
        else negative += value
      }
      const x = center - groupWidth * 0.36 + (chart.stacked ? 0 : seriesIndex * barWidth)
      const end = fixedMaximum !== null ? Math.max(minimum, Math.min(maximum, start + value)) : start + value
      const top = Math.min(y(start), y(end))
      const height = Math.abs(y(end) - y(start))
      const color = series.color
      const kind = chartIndicatorKind(chart)
      const resultColor = kind ? indicatorColor(kind, value) : null
      const title = `${series.name} · ${label || chart.title}: ${chartResult(chart, value)}`
      svg.push(`<g><title>${escapeReportHtml(title)}</title><rect x="${x}" y="${top}" width="${barWidth * 0.92}" height="${height}" fill="${color}"/>`)
      if (chart.threeDimensional && height > 0) {
        const right = x + barWidth * 0.92
        const depth = Math.min(8, barWidth * 0.25)
        svg.push(`<path d="M${x},${top} l${depth},-${depth} h${barWidth * 0.92} l-${depth},${depth} Z" fill="${luminance(color, 0.7, 0.3)}"/>`,
          `<path d="M${right},${top} l${depth},-${depth} v${height} l-${depth},${depth} Z" fill="${luminance(color, 0.7)}"/>`)
      }
      const overflow = fixedMaximum !== null ? value < minimum ? ' ↓' : value > maximum ? ' ↑' : '' : ''
      if (chart.showValues) svg.push(`<text x="${x + barWidth / 2}" y="${top - 12}" text-anchor="middle" fill="${resultColor ?? '#000000'}">${format(value)}${overflow}</text>`)
      else if (overflow) svg.push(`<text x="${x + barWidth / 2}" y="${top - 5}" text-anchor="middle" fill="${resultColor ?? '#000000'}">${overflow.trim()}</text>`)
      svg.push('</g>')
    })
  })
  let legendX = 45
  let legendY = chart.labels.length > 10 ? 390 : 325
  if (chart.series.length > 1) {
    chart.series.forEach(series => {
      const itemWidth = Math.min(910, 30 + series.name.length * 6.5)
      if (chart.legendRight) {
        legendX = 800
        legendY = 30 + chart.series.indexOf(series) * 23
      } else if (legendX + itemWidth > 970) {
        legendX = 45
        legendY += 24
      }
      svg.push(`<rect x="${legendX}" y="${legendY - 10}" width="12" height="12" fill="${series.color}"/><text x="${legendX + 19}" y="${legendY}" fill="#595959">${escapeReportHtml(series.name)}</text>`)
      legendX += itemWidth
    })
  }
  const height = Math.max(chart.labels.length > 10 ? 410 : 355, legendY + 30)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeReportHtml(chart.title)}" style="display:block;width:100%;height:auto;background:white;font:13px Arial,sans-serif"><title>${escapeReportHtml(chart.title)}</title>${svg.join('')}</svg>`
}

export const workbookReportStyles = `
.workbook-ipf { color:#000; background:#fff; font:13px/1.45 Arial,sans-serif; padding:24px; border:1px solid #BFBFBF; max-width:1100px; margin:0 auto; }
.workbook-ipf * { box-sizing:border-box; }
.workbook-ipf h2 { margin:0; color:#000; font-size:18px; }
.workbook-ipf .workbook-header { display:grid; grid-template-columns:1fr auto; gap:16px; border-bottom:2px solid #000; padding-bottom:14px; margin-bottom:16px; }
.workbook-ipf .workbook-header strong { font-size:20px; }
.workbook-ipf .workbook-header img { max-width:180px; max-height:70px; object-fit:contain; }
.workbook-ipf .workbook-details { width:100%; min-width:0; table-layout:fixed; border-collapse:collapse; margin-bottom:20px; }
.workbook-ipf .workbook-details td { padding:5px 8px; border:1px solid #BFBFBF; text-align:left; color:#000; font-size:12px; white-space:normal; overflow-wrap:anywhere; }
.workbook-ipf .workbook-details td:first-child { width:32%; font-weight:bold; }
.workbook-ipf .workbook-band { background:#00B050; color:#fff; padding:7px 10px; font-size:14px; font-weight:bold; margin:18px 0; }
.workbook-ipf .workbook-subtitle { margin:16px 0; font-size:13px; font-weight:bold; }
.workbook-ipf .workbook-note { margin:12px 0; text-align:center; font-size:13px; color:#000; }
.workbook-ipf .workbook-score { display:flex; flex-wrap:wrap; gap:24px; justify-content:center; padding:16px; margin:12px 0; border:1px solid #BFBFBF; font-size:16px; font-weight:bold; }
.workbook-ipf .workbook-chart { margin:20px 0; border:1px solid #D9D9D9; background:#fff; padding:14px 8px 0; break-inside:avoid; }
.workbook-ipf .workbook-chart h3 { margin:0 0 8px; text-align:center; color:#595959; font:20px Arial,sans-serif; }
.workbook-ipf .workbook-chart svg { min-width:0; }
.workbook-ipf .workbook-chart details { padding:8px; font-size:12px; }
.workbook-ipf .workbook-chart summary { cursor:pointer; color:#595959; }
.workbook-ipf .workbook-values { overflow-x:auto; }
.workbook-ipf .workbook-values table { width:100%; border-collapse:collapse; margin-top:10px; }
.workbook-ipf .workbook-values th, .workbook-ipf .workbook-values td { padding:5px; border:1px solid #D9D9D9; font-size:11px; color:#000; text-align:right; white-space:normal; }
.workbook-ipf .workbook-values th:first-child { text-align:left; }
.workbook-ipf .workbook-footer { color:#595959; font-size:11px; margin-top:16px; }
@media (max-width:600px) { .workbook-ipf { padding:12px; } .workbook-ipf .workbook-chart { overflow-x:auto; } .workbook-ipf .workbook-chart svg { min-width:700px; } }
@media print { .workbook-ipf { border:0; padding:0; max-width:none; } .workbook-ipf .workbook-chart { break-inside:avoid; } .workbook-ipf .workbook-chart details { display:none; } .workbook-ipf .workbook-chart svg { min-width:0; } }
`

export function workbookChartHtml(chart: WorkbookChart) {
  const number = (value: number | null) => {
    const kind = chartIndicatorKind(chart)
    const color = kind ? indicatorColor(kind, value) : null
    const result = chartResult(chart, value)
    return color ? `<span style="color:${color}">${result}</span>` : result
  }
  const scaleMaximum = chart.id === 'ipf' ? 10 : chart.id === 'ids-history' || chart.id === 'ids' ? 1 : null
  const outsideScale = scaleMaximum !== null && chart.series.some(series =>
    series.values.some(value => value !== null && (value < 0 || value > scaleMaximum)))
  return `<article class="workbook-chart" data-chart-id="${escapeReportHtml(chart.id)}">
    <h3>${escapeReportHtml(chart.title)}</h3>${workbookChartSvg(chart)}
    ${outsideScale ? `<p class="workbook-note">Setas indicam valores fora da escala de ${chart.id === 'ipf' ? '0 a 10' : '0% a 100%'}; os valores reais constam na tabela de dados.</p>` : ''}
    <details><summary>Consultar dados de ${escapeReportHtml(chart.title)}</summary><div class="workbook-values"><table>
      <thead><tr><th>Série</th>${chart.labels.map(label => `<th>${escapeReportHtml(label || 'Resultado')}</th>`).join('')}</tr></thead>
      <tbody>${chart.series.map(series => `<tr><th>${escapeReportHtml(series.name)}</th>${series.values.map(value => `<td>${number(value)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div></details>
  </article>`
}
