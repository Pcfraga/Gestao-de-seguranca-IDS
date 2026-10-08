import type { EvaluationResult, IpfAnnualHistory } from './api'

const printStyles = `
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #24352a; font: 12px/1.5 Arial, sans-serif; }
  h1 { margin: 0; color: #173e2e; font-size: 24px; }
  h2 { margin: 0 0 10px; color: #244d37; font-size: 15px; }
  p { margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #24543f; padding-bottom: 12px; margin-bottom: 18px; }
  .brand { color: #52655a; font-size: 11px; text-align: right; }
  .subtitle { margin-top: 4px; color: #52655a; font-size: 13px; }
  .section { margin: 18px 0; break-inside: avoid; }
  .details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 20px; }
  .detail { padding-bottom: 5px; border-bottom: 1px solid #dce5dd; }
  .label { display: block; color: #52655a; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .value { display: block; overflow-wrap: anywhere; white-space: pre-wrap; }
  .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .metric { padding: 10px; border: 1px solid #dce5dd; border-radius: 4px; }
  .metric strong { display: block; color: #173e2e; font-size: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { padding: 7px 8px; border: 1px solid #dce5dd; text-align: left; vertical-align: top; overflow-wrap: anywhere; white-space: pre-wrap; }
  th { background: #edf4ee; color: #244d37; }
  .number { text-align: right; white-space: nowrap; }
  .muted { color: #52655a; }
  .note { margin-top: 10px; padding: 10px; border: 1px solid #dce5dd; border-radius: 4px; }
  .bar-track { min-width: 80px; height: 8px; background: #edf1ed; }
  .bar { height: 8px; background: #3d7655; }
  .footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #dce5dd; color: #52655a; font-size: 10px; }
  @media print { tr, .metric { break-inside: avoid; } }
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

function detail(label: string, value: string | number | null | undefined) {
  return `<div class="detail"><span class="label">${escapeHtml(label)}</span><span class="value">${text(value)}</span></div>`
}

function metric(label: string, value: string) {
  return `<div class="metric"><span class="label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
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
    <header class="header"><div><h1>Avaliação de segurança</h1><p class="subtitle">Registro individual de observações</p></div><div class="brand"><strong>IDS</strong><br>Gestão de segurança operacional</div></header>
    <section class="section"><h2>Identificação</h2><div class="details">
      ${detail('Data', formatDate(evaluation.evaluationDate))}
      ${detail('Horário', evaluation.evaluationTime?.slice(0, 5))}
      ${detail('Status', evaluation.status === 'Draft' ? 'Rascunho' : 'Concluída')}
      ${detail('Local / projeto', [evaluation.site, evaluation.projectOrIsland].filter(Boolean).join(' · '))}
      ${detail('Cliente', evaluation.client)}
      ${detail('Contratada', evaluation.contractor)}
      ${detail('Subcontratada', evaluation.subcontractor)}
      ${detail('Pessoas observadas', formatNumber(evaluation.indicators.observedPeople))}
      ${detail('Avaliador principal', evaluation.leadAuditorName)}
      ${detail('Avaliador', evaluation.auditorName)}
      ${detail('Acompanhante', evaluation.companionName)}
    </div></section>
    <section class="section"><h2>Indicadores</h2><div class="metrics">
      ${metric('IDS', evaluation.indicators.ids === null ? '—' : `${formatNumber(evaluation.indicators.ids * 100, 1)}%`)}
      ${metric('Pessoas observadas', formatNumber(evaluation.indicators.observedPeople))}
      ${metric('Desvios registrados', formatNumber(evaluation.indicators.totalDeviations))}
      ${metric('Desvio ponderado (SD)', formatNumber(evaluation.indicators.weightedDeviationTotal))}
    </div></section>
    <section class="section"><h2>Observações</h2><table><thead><tr><th>Categoria</th><th>Item</th><th class="number">Quantidade</th><th class="number">Severidade</th><th>Comentário</th></tr></thead><tbody>
      ${observations || '<tr><td colspan="5">Nenhuma observação registrada.</td></tr>'}
    </tbody></table></section>
    <section class="section"><h2>Contexto</h2>
      <div class="note"><span class="label">Pontos fortes</span><p>${text(evaluation.strengths)}</p></div>
      <div class="note"><span class="label">Oportunidades de melhoria</span><p>${text(evaluation.improvementOpportunities)}</p></div>
    </section>
    <footer class="footer">Documento gerado pelo IDS · ${escapeHtml(new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date()))}</footer>`

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
  const title = `Relatório IPF ${history.year} - ${history.contractor}`
  const content = `
    <header class="header"><div><h1>Relatório de IPF</h1><p class="subtitle">Janeiro a ${escapeHtml(monthName(upToMonth))} de ${escapeHtml(String(history.year))} · ${text(history.contractor)}</p></div><div class="brand"><strong>IDS</strong><br>Gestão de segurança operacional</div></header>
    <section class="section">    <h2>Resumo do período</h2><div class="metrics">
      ${metric('Contratada', history.contractor)}
          ${metric('Período', `Janeiro a ${monthName(upToMonth)} de ${history.year}`)}
          ${metric('Média dos meses informados', history.months.length ? formatNumber(history.annualAverage) : '—')}
      ${metric('Meses com IPF', String(history.months.length))}
    </div></section>
    <section class="section"><h2>Histórico mensal</h2><table><thead><tr><th>Mês</th><th class="number">IPF</th><th>Local / site</th><th>Origem</th><th>Última atualização</th><th>Evolução</th></tr></thead><tbody>${rows}</tbody></table></section>
    <p class="note muted">O IPF é informado manualmente ou importado. A média considera somente os meses preenchidos; este relatório não calcula o IPF.</p>
    <footer class="footer">Documento gerado pelo IDS · ${escapeHtml(new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date()))}</footer>`

  return { title, content }
}
