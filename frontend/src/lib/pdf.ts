import type { EvaluationResult, IpfAnnualHistory } from './api'
import { loadBranding } from './branding'

const printStyles = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1f2f25; font: 11px/1.45 Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1 { margin: 0; color: #173e2e; font-size: 18px; }
  p { margin: 0; }
  table.frame { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0 0 10px; border: 2px solid #173e2e; font-size: 11px; }
  .frame th, .frame td { padding: 6px 8px; border: 1px solid #8fa598; text-align: left; vertical-align: middle; overflow-wrap: anywhere; white-space: pre-wrap; }
  .frame .sec-title { background: #173e2e; border-color: #173e2e; color: #fff; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
  .frame .lbl { background: #edf4ee; color: #244d37; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .frame thead th { background: #dcebe0; color: #173e2e; font-size: 10px; text-transform: uppercase; border-bottom: 2px solid #173e2e; }
  .frame .big { font-size: 16px; font-weight: 700; color: #173e2e; text-align: center; }
  .frame .center { text-align: center; }
  .frame .number { text-align: right; white-space: nowrap; }
  .head-logo { text-align: center; }
  .head-logo img { display: block; max-width: 100%; max-height: 64px; margin: 0 auto; object-fit: contain; }
  .head-company strong { display: block; color: #173e2e; font-size: 14px; }
  .head-company span { display: block; color: #52655a; font-size: 10px; }
  .head-title { text-align: right !important; }
  .head-title p { margin-top: 2px; color: #52655a; font-size: 10px; }
  .frame .contractor-label { border-top: 2px solid #173e2e; background: #edf4ee; color: #244d37; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .frame .contractor-name { border-top: 2px solid #173e2e; background: #fff; color: #173e2e; font-size: 16px; font-weight: 700; }
  .bar-track { min-width: 70px; height: 8px; background: #edf1ed; }
  .bar { height: 8px; background: #3d7655; }
  .muted { color: #52655a; font-size: 10px; }
  .footer { margin-top: 12px; color: #52655a; font-size: 10px; text-align: right; }
  @media print { tr { break-inside: avoid; } table.frame { break-inside: auto; } }
`

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

function text(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '—' : escapeHtml(String(value))
}

function formatNumber(value: number | null | undefined, maximumFractionDigits = 2) {
  return value === null || value === undefined ? '—' : value.toLocaleString('pt-BR', { maximumFractionDigits })
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`))
}

function generatedAt() {
  return escapeHtml(new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date()))
}

function reportHeader(documentTitle: string, subtitle: string, contractor: string | null | undefined) {
  const branding = loadBranding()
  const hasLogo = Boolean(branding.logoDataUrl)
  const company = branding.companyName
    ? `<strong>${escapeHtml(branding.companyName)}</strong>${branding.tagline ? `<span>${escapeHtml(branding.tagline)}</span>` : ''}`
    : '<strong>IDS</strong><span>Gestão de segurança operacional</span>'
  return `<table class="frame">
    <colgroup><col style="width:24%"><col style="width:42%"><col style="width:34%"></colgroup>
    <tr>
      ${hasLogo ? `<td class="head-logo"><img src="${branding.logoDataUrl}" alt=""></td>` : ''}
      <td class="head-company"${hasLogo ? '' : ' colspan="2"'}>${company}</td>
      <td class="head-title"><h1>${escapeHtml(documentTitle)}</h1><p>${escapeHtml(subtitle)}</p></td>
    </tr>
    <tr><td class="contractor-label">Contratada</td><td class="contractor-name" colspan="2">${text(contractor)}</td></tr>
  </table>`
}

function sectionTitle(title: string, columns: number) {
  return `<tr><th class="sec-title" colspan="${columns}">${escapeHtml(title)}</th></tr>`
}

function detailsTable(title: string, entries: Array<[string, string | number | null | undefined]>) {
  const rows: string[] = []
  for (let index = 0; index < entries.length; index += 2) {
    const [leftLabel, leftValue] = entries[index]
    const right = entries[index + 1]
    rows.push(`<tr><td class="lbl">${escapeHtml(leftLabel)}</td><td${right ? '' : ' colspan="3"'}>${text(leftValue)}</td>${right ? `<td class="lbl">${escapeHtml(right[0])}</td><td>${text(right[1])}</td>` : ''}</tr>`)
  }
  return `<table class="frame"><colgroup><col style="width:19%"><col style="width:31%"><col style="width:19%"><col style="width:31%"></colgroup>${sectionTitle(title, 4)}${rows.join('')}</table>`
}

function metricsTable(title: string, entries: Array<[string, string]>) {
  const columns = entries.length
  return `<table class="frame">${sectionTitle(title, columns)}
    <tr>${entries.map(([label]) => `<td class="lbl center">${escapeHtml(label)}</td>`).join('')}</tr>
    <tr>${entries.map(([, value]) => `<td class="big">${escapeHtml(value)}</td>`).join('')}</tr>
  </table>`
}

function notesTable(title: string, entries: Array<[string, string | null | undefined]>) {
  return `<table class="frame"><colgroup><col style="width:24%"><col style="width:76%"></colgroup>${sectionTitle(title, 2)}
    ${entries.map(([label, value]) => `<tr><td class="lbl">${escapeHtml(label)}</td><td>${text(value)}</td></tr>`).join('')}
  </table>`
}

function documentHtml(title: string, content: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${printStyles}</style></head><body>${content}<script>window.addEventListener('load', () => window.setTimeout(() => window.print(), 250))</script></body></html>`
}

export function writePrintWindow(printWindow: Window, title: string, content: string) {
  printWindow.document.open()
  printWindow.document.write(documentHtml(title, content))
  printWindow.document.close()
}

export function openPrintWindow(title: string, content: string) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return false

  writePrintWindow(printWindow, title, content)
  return true
}

export function evaluationPdf(evaluation: EvaluationResult) {
  const title = `Avaliação IDS - ${evaluation.evaluationDate}`
  const observations = [...evaluation.observations]
    .sort((left, right) => left.category.localeCompare(right.category, 'pt-BR') || left.item.localeCompare(right.item, 'pt-BR'))
    .map(observation => `<tr><td>${text(observation.category)}</td><td>${text(observation.item)}</td><td class="number">${formatNumber(observation.quantity)}</td><td class="number">${formatNumber(observation.severityWeight)}</td><td>${text(observation.comment)}</td></tr>`)
    .join('')
  const content = `
    ${reportHeader('Avaliação de segurança', `Registro individual · ${formatDate(evaluation.evaluationDate)}`, evaluation.contractor)}
    ${detailsTable('Identificação', [
      ['Data', formatDate(evaluation.evaluationDate)],
      ['Horário', evaluation.evaluationTime?.slice(0, 5)],
      ['Status', evaluation.status === 'Draft' ? 'Rascunho' : 'Concluída'],
      ['Local / projeto', [evaluation.site, evaluation.projectOrIsland].filter(Boolean).join(' · ')],
      ['Cliente', evaluation.client],
      ['Contratada', evaluation.contractor],
      ['Subcontratada', evaluation.subcontractor],
      ['Pessoas observadas', formatNumber(evaluation.indicators.observedPeople)],
      ['Avaliador principal', evaluation.leadAuditorName],
      ['Avaliador', evaluation.auditorName],
      ['Acompanhante', evaluation.companionName],
    ])}
    ${metricsTable('Indicadores', [
      ['IDS', evaluation.indicators.ids === null ? '—' : `${formatNumber(evaluation.indicators.ids * 100, 1)}%`],
      ['Pessoas observadas', formatNumber(evaluation.indicators.observedPeople)],
      ['Desvios registrados', formatNumber(evaluation.indicators.totalDeviations)],
      ['Desvio ponderado (SD)', formatNumber(evaluation.indicators.weightedDeviationTotal)],
    ])}
    <table class="frame"><colgroup><col style="width:17%"><col style="width:25%"><col style="width:11%"><col style="width:11%"><col style="width:36%"></colgroup>
      ${sectionTitle('Observações', 5)}
      <thead><tr><th>Categoria</th><th>Item</th><th class="number">Quantidade</th><th class="number">Severidade</th><th>Comentário</th></tr></thead>
      <tbody>${observations || '<tr><td colspan="5">Nenhuma observação registrada.</td></tr>'}</tbody>
    </table>
    ${notesTable('Contexto', [['Pontos fortes', evaluation.strengths], ['Oportunidades de melhoria', evaluation.improvementOpportunities]])}
    <footer class="footer">Documento gerado pelo IDS · ${generatedAt()}</footer>`

  return { title, content }
}

export function ipfReportPdf(history: IpfAnnualHistory, upToMonth = 12) {
  const monthName = (month: number) => new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(Date.UTC(history.year, month - 1, 15)))
  const records = new Map(history.months.map(record => [record.month, record]))
  const highestValue = Math.max(0, ...history.months.map(record => record.value))
  const rows = Array.from({ length: upToMonth }, (_, index) => {
    const month = index + 1
    const record = records.get(month)
    const width = record && highestValue > 0 ? Math.max(2, (record.value / highestValue) * 100) : 0
    return `<tr><td>${escapeHtml(monthName(month))}</td><td class="number">${record ? formatNumber(record.value) : '—'}</td><td>${text(record?.site)}</td><td>${text(record?.source)}</td><td>${record ? escapeHtml(new Intl.DateTimeFormat('pt-BR').format(new Date(record.updatedAtUtc))) : '—'}</td><td><div class="bar-track"><div class="bar" style="width:${width}%"></div></div></td></tr>`
  }).join('')
  const period = `Janeiro a ${monthName(upToMonth)} de ${history.year}`
  const title = `Relatório IPF ${history.year} - ${history.contractor}`
  const content = `
    ${reportHeader('Relatório de IPF', period, history.contractor)}
    ${detailsTable('Identificação', [
      ['Contratada', history.contractor],
      ['Período', period],
      ['Meses com IPF', String(history.months.length)],
      ['Média dos meses informados', history.months.length ? formatNumber(history.annualAverage) : '—'],
    ])}
    <table class="frame"><colgroup><col style="width:17%"><col style="width:12%"><col style="width:23%"><col style="width:14%"><col style="width:16%"><col style="width:18%"></colgroup>
      ${sectionTitle('Histórico mensal', 6)}
      <thead><tr><th>Mês</th><th class="number">IPF</th><th>Local / site</th><th>Origem</th><th>Atualização</th><th>Evolução</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table class="frame"><tr><td class="muted">O IPF é informado manualmente ou importado. A média considera somente os meses preenchidos; este relatório não calcula o IPF.</td></tr></table>
    <footer class="footer">Documento gerado pelo IDS · ${generatedAt()}</footer>`

  return { title, content }
}
