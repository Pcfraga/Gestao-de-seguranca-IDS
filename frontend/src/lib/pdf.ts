import type { EvaluationResult, IpfAnnualHistory, IpfComposition } from './api'
import { loadBranding, shade } from './branding'
import { workbookChartHtml, workbookReportStyles, type WorkbookChart } from './workbookReport'
import { formatIds, formatIdsNumber, formatIpf } from './indicatorFormat'
import { indicatorColor, indicatorStatus, type IndicatorKind } from './indicatorStatus'

function printStyles(primary: string) {
  const border = shade(primary, 0.55)
  const soft = shade(primary, 0.92)
  const head = shade(primary, 0.84)
  const accent = shade(primary, 0.12)
  return `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1f2f25; font: 11px/1.45 Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1 { margin: 0; color: ${primary}; font-size: 18px; }
  p { margin: 0; }
  table.frame { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0 0 10px; border: 2px solid ${primary}; font-size: 11px; }
  .frame th, .frame td { padding: 6px 8px; border: 1px solid ${border}; text-align: left; vertical-align: middle; overflow-wrap: anywhere; white-space: pre-wrap; }
  .frame .sec-title { background: ${primary}; border-color: ${primary}; color: #fff; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
  .frame .lbl { background: ${soft}; color: ${primary}; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .frame thead th { background: ${head}; color: ${primary}; font-size: 10px; text-transform: uppercase; border-bottom: 2px solid ${primary}; }
  .frame .big { font-size: 16px; font-weight: 700; color: ${primary}; text-align: center; }
  .frame .center { text-align: center; }
  .frame .number { text-align: right; white-space: nowrap; }
  .head-logo { text-align: center; }
  .head-logo img { display: block; max-width: 100%; max-height: 64px; margin: 0 auto; object-fit: contain; }
  .head-company strong { display: block; color: ${primary}; font-size: 14px; }
  .head-company span { display: block; color: #52655a; font-size: 10px; }
  .head-title { text-align: right !important; }
  .head-title p { margin-top: 2px; color: #52655a; font-size: 10px; }
  .frame .contractor-label { border-top: 2px solid ${primary}; background: ${soft}; color: ${primary}; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .frame .contractor-name { border-top: 2px solid ${primary}; background: #fff; color: ${primary}; font-size: 16px; font-weight: 700; }
  .bar-track { min-width: 70px; height: 8px; background: #edf1ed; }
  .bar { height: 8px; background: ${accent}; }
  .muted { color: #52655a; font-size: 10px; }
  .footer { margin-top: 12px; color: #52655a; font-size: 10px; text-align: right; }
  @media print { tr { break-inside: avoid; } table.frame { break-inside: auto; } }
`
}

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

function indicatorHtml(kind: IndicatorKind, value: number | null | undefined, originalScale = false) {
  const formatted = kind === 'ipf' ? formatIpf(value)
    : originalScale ? formatIdsNumber(value) : formatIds(value)
  const status = indicatorStatus(kind, value)
  const color = indicatorColor(kind, value)
  return status && color ? `<span style="color:${color}">${formatted} · ${status}</span>` : formatted
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

function detailsTable(title: string, entries: Array<[string, string | number | null | undefined, { kind: IndicatorKind; value: number | null | undefined; originalScale?: boolean }?]>) {
  const renderValue = (entry: typeof entries[number]) => entry[2]
    ? indicatorHtml(entry[2].kind, entry[2].value, entry[2].originalScale)
    : text(entry[1])
  const rows: string[] = []
  for (let index = 0; index < entries.length; index += 2) {
    const [leftLabel] = entries[index]
    const right = entries[index + 1]
    rows.push(`<tr><td class="lbl">${escapeHtml(leftLabel)}</td><td${right ? '' : ' colspan="3"'}>${renderValue(entries[index])}</td>${right ? `<td class="lbl">${escapeHtml(right[0])}</td><td>${renderValue(right)}</td>` : ''}</tr>`)
  }
  return `<table class="frame"><colgroup><col style="width:19%"><col style="width:31%"><col style="width:19%"><col style="width:31%"></colgroup>${sectionTitle(title, 4)}${rows.join('')}</table>`
}

function metricsTable(title: string, entries: Array<[string, string, { kind: IndicatorKind; value: number | null | undefined }?]>) {
  const columns = entries.length
  return `<table class="frame">${sectionTitle(title, columns)}
    <tr>${entries.map(([label]) => `<td class="lbl center">${escapeHtml(label)}</td>`).join('')}</tr>
    <tr>${entries.map(([, value, indicator]) => `<td class="big">${indicator ? indicatorHtml(indicator.kind, indicator.value) : escapeHtml(value)}</td>`).join('')}</tr>
  </table>`
}

function notesTable(title: string, entries: Array<[string, string | null | undefined]>) {
  return `<table class="frame"><colgroup><col style="width:24%"><col style="width:76%"></colgroup>${sectionTitle(title, 2)}
    ${entries.map(([label, value]) => `<tr><td class="lbl">${escapeHtml(label)}</td><td>${text(value)}</td></tr>`).join('')}
  </table>`
}

function documentHtml(title: string, content: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${printStyles(loadBranding().primaryColor)}</style></head><body>${content}<script>window.addEventListener('load', () => window.setTimeout(() => window.print(), 250))</script></body></html>`
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
      ['Área', evaluation.areaName],
      ['Formulário', evaluation.formName],
      ['Versão do formulário', evaluation.formVersion ? String(evaluation.formVersion) : 'Modelo original'],
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
      ['IDS', formatIds(evaluation.indicators.ids), { kind: 'ids', value: evaluation.indicators.ids }],
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
    return `<tr><td>${escapeHtml(monthName(month))}</td><td class="number">${indicatorHtml('ipf', record?.value)}</td><td>${text(record?.site)}</td><td>${text(record?.source)}</td><td>${record ? escapeHtml(new Intl.DateTimeFormat('pt-BR').format(new Date(record.updatedAtUtc))) : '—'}</td><td><div class="bar-track"><div class="bar" style="width:${width}%"></div></div></td></tr>`
  }).join('')
  const period = `Janeiro a ${monthName(upToMonth)} de ${history.year}`
  const title = `Relatório IPF ${history.year} - ${history.contractor}`
  const content = `
    ${reportHeader('Relatório de IPF', period, history.contractor)}
    ${detailsTable('Identificação', [
      ['Área', history.areaName],
      ['Formulário', history.formName],
      ['Contratada', history.contractor],
      ['Período', period],
      ['Meses com IPF', String(history.months.length)],
      ['Média dos meses informados', null, { kind: 'ipf', value: history.months.length ? history.annualAverage : null }],
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

export interface MonthlyIpfReportData {
  year: number
  month: number
  monthLabel: string
  contractor: string
  projectOrIsland: string | null
  site: string | null
  client: string | null
  discipline: string
  evaluatedBy: string | null
  issuedAt: string
  ipfValue: number | null
  ipfAverage: number | null
  idsAverage: number | null
  idsAnnualAverage: number | null
  ipfMonths: Array<{ month: number; value: number | null }>
  idsMonths: Array<{ month: number; value: number | null }>
  weeklyIds: Array<{ label: string; values: Array<number | null>; average: number | null }>
  charts: WorkbookChart[]
}

export function monthlyIpfReportPdf(report: MonthlyIpfReportData) {
  const issueDate = new Intl.DateTimeFormat('pt-BR').format(new Date(report.issuedAt))
  const issueTime = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(report.issuedAt))
  const branding = loadBranding()
  const identification: Array<[string, string | null]> = [
    ['Nome do projeto e Ilha', report.projectOrIsland],
    ['Local do site', report.site],
    ['Cliente', report.client],
    ['Contratada', report.contractor],
    ['Disciplina', report.discipline],
    ['Mês e ano da avaliação', report.monthLabel],
    ['Avaliado por', report.evaluatedBy],
    ['Data de emissão', issueDate],
    ['Horário de emissão', issueTime],
  ]
  const title = `Relatório IPF ${report.monthLabel} - ${report.contractor}`
  const content = `<style>${workbookReportStyles}</style><section class="workbook-ipf" aria-label="Relatório IPF">
    <header class="workbook-header"><div><strong>HSE</strong><h2>Relatório IPF</h2><p>${text(branding.companyName)}</p></div>
      ${branding.logoDataUrl ? `<img src="${escapeHtml(branding.logoDataUrl)}" alt="Logo da empresa">` : ''}
    </header>
    <table class="workbook-details"><caption>Informações da Contratada e da Avaliação</caption><tbody>
      ${identification.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${text(value)}</td></tr>`).join('')}
    </tbody></table>
    <h2 class="workbook-band">IPF DE HSE</h2>
    <p class="workbook-note">A nota mínima para atingir a meta do IPF mensal é 7 (sete).</p>
    <p class="workbook-note">Quando o IPF for menor do que 7 (sete) deverá ser apresentado um plano de ação pela contratada.</p>
    <div class="workbook-score"><span>IPF</span><strong>${indicatorHtml('ipf', report.ipfValue)}</strong></div>
    ${report.charts.slice(0, 1).map(workbookChartHtml).join('')}
    <h2 class="workbook-band">IDS</h2>
    <h3 class="workbook-subtitle">(1) Resultados do IDS - Semanal e Média do Mês</h3>
    ${report.charts.slice(1, 2).map(workbookChartHtml).join('')}
    <div class="workbook-score"><span>Resultados dos IDS</span><strong>${indicatorHtml('ids', report.idsAverage)}</strong></div>
    <h3 class="workbook-subtitle">(2) Gráficos</h3>
    ${report.charts.slice(2).map(workbookChartHtml).join('')}
    <footer class="workbook-footer">Semanas S1–S5: dias 1–7, 8–14, 15–21, 22–28 e 29–31; domingos excluídos. Dados conforme os filtros e permissões de consulta. Emitido em ${issueDate} às ${issueTime}.</footer>
  </section>`

  return { title, content }
}

export function ipfCompositionPdf(record: IpfComposition) {
  const period = `${String(record.month).padStart(2, '0')}/${record.year}`
  const title = `IPF por disciplinas ${period} - ${record.contractor}`
  const number = (value: number | null) => value === null ? '—' : value.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
  const rows = record.areas.map(area => `<tr>
    <td>${escapeHtml(area.areaName)}</td>
    <td class="number">${indicatorHtml('ids', area.average, true)}</td>
    <td>${area.scoredEvaluationCount} / ${area.evaluationCount}</td>
    <td class="number">${number(area.weight)}%</td>
    <td class="number">${number(area.effectiveWeight)}%</td>
    <td class="number">${number(area.contribution)}</td>
    <td>${area.status === 'included' ? 'Participou' : area.status === 'zero-weight' ? 'Sem peso' : 'Sem média — excluída'}</td>
  </tr>`).join('')
  const content = `${reportHeader('IPF por disciplinas', period, record.contractor)}
    ${detailsTable('Identificação', [
      ['Período', period],
      ['IPF final', null, { kind: 'ipf', value: record.value }],
      ['Situação', record.id ? 'Composição salva' : 'Prévia — ainda não salva'],
      ['Salvo em', record.updatedAtUtc ? new Date(record.updatedAtUtc).toLocaleString('pt-BR') : null],
    ])}
    <table class="frame">${sectionTitle('Médias e pesos', 7)}
      <thead><tr><th>Disciplina</th><th>Média IDS</th><th>Válidas / total</th><th>Peso definido</th><th>Peso aplicado</th><th>Contribuição</th><th>Situação</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table class="frame"><tr><td>As médias incluem todos os formulários de cada área para a contratada no mês, na escala original do IDS. Áreas sem média ou com peso 0% ficam fora; os demais pesos são ajustados proporcionalmente para 100%. Média válida igual a zero participa normalmente. Fórmula: soma das médias × pesos definidos, dividida pela soma dos pesos participantes. O cálculo usa médias sem arredondamento intermediário e arredonda a nota final a quatro casas. A classificação aplica o limite literal de IPF 7, sem conversão de escala; valores de 0 a 1 não atingem a meta.</td></tr></table>
    <footer class="footer">Documento gerado pelo IDS · ${generatedAt()}</footer>`
  return { title, content }
}
