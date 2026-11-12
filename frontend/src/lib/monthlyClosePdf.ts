import { loadBranding } from './branding'
import { formatIds } from './indicatorFormat'
import { escapeReportHtml } from './workbookReport'
import { formatPercent } from './severityChart'

interface ChartItem {
  name: string
  quantity: number
}

export interface MonthlyClosePdfData {
  month: string
  company: string
  project: string
  area: string
  form: string
  ids: number | null
  evaluations: number
  observedPeople: number
  deviations: number
  weightedDeviation: number
  severity: ChartItem[]
  categories: ChartItem[]
  selectedCategory: string
  items: ChartItem[]
}

const colors = ['#70a681', '#d2a052', '#bd6963']
const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const safe = escapeReportHtml

function barChart(items: ChartItem[]) {
  const sorted = items.filter(item => item.quantity > 0).sort((a, b) => b.quantity - a.quantity)
  const rows = sorted.slice(0, 5)
  const remaining = sorted.slice(5)
  if (remaining.length) rows.push({ name: `Outros (${remaining.length})`, quantity: remaining.reduce((sum, item) => sum + item.quantity, 0) })
  if (!rows.length) return '<p class="empty">Sem dados neste recorte.</p>'
  const maximum = Math.max(...rows.map(item => item.quantity))
  return `<div class="bars">${rows.map(item => `<div class="bar-row">
    <span class="bar-name" title="${safe(item.name)}">${safe(item.name)}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${item.quantity / maximum * 100}%"></span></span>
    <strong>${number(item.quantity)}</strong>
  </div>`).join('')}</div>`
}

function severityChart(items: ChartItem[]) {
  const total = items.reduce((sum, item) => sum + item.quantity, 0)
  if (!total) return '<p class="empty">Sem desvios com severidade informada.</p>'
  let offset = 0
  const segments = items.map((item, index) => {
    const share = item.quantity / total
    const segment = `<circle cx="80" cy="80" r="55" pathLength="100" fill="none" stroke="${colors[index]}" stroke-width="24" stroke-dasharray="${share * 100} ${100 - share * 100}" stroke-dashoffset="${-offset}"/>`
    offset += share * 100
    return segment
  }).join('')
  return `<div class="severity"><svg viewBox="0 0 160 160" aria-label="Distribuição por severidade"><g transform="rotate(-90 80 80)">${segments}</g></svg>
    <div class="severity-legend">${items.map((item, index) => `<div><i style="background:${colors[index]}"></i>${safe(item.name)} <strong>${formatPercent(item.quantity / total)}</strong> <small>(${number(item.quantity)})</small></div>`).join('')}</div></div>`
}

export function monthlyClosePdf(data: MonthlyClosePdfData) {
  const branding = loadBranding()
  const [year, month] = data.month.split('-').map(Number)
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 15)))
  const title = `Fechamento mensal - ${monthLabel}`
  const cards = [
    ['IDS médio', formatIds(data.ids)],
    ['Avaliações', number(data.evaluations)],
    ['Pessoas observadas', number(data.observedPeople)],
    ['Desvios registrados', number(data.deviations)],
    ['Risco ponderado', number(data.weightedDeviation)],
  ]
  const content = `<style>
    @page { size: 320mm 180mm; margin: 0; }
    html, body { margin: 0; padding: 0; width: 320mm; height: 180mm; background: white; }
    .slide, .slide * { box-sizing: border-box; }
    .slide { width: 320mm; height: 180mm; padding: 8mm 10mm; display: flex; flex-direction: column; gap: 4mm; color: #23362a; background: #fff; font: 12px Arial, sans-serif; overflow: hidden; }
    .slide header { display:flex; justify-content:space-between; align-items:center; gap:12px; min-height:20mm; border-bottom:2px solid #3b8054; padding-bottom:3mm; }
    .slide header > div { min-width:0; }
    .slide h1 { font-size:23px; margin:0 0 4px; color:#254a33; }
    .slide header p { margin:0; color:#52665a; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .slide header img { max-width:110px; max-height:50px; object-fit:contain; }
    .slide .cards { display:grid; grid-template-columns:repeat(5,1fr); gap:3mm; }
    .slide .card { background:#edf6ef; border-left:4px solid #4d9d65; padding:3mm; min-width:0; }
    .slide .card span { display:block; font-size:10px; color:#516b59; }
    .slide .card strong { display:block; margin-top:3px; font-size:21px; }
    .slide .grid { flex:1; min-height:0; display:grid; grid-template-columns:1fr 1.15fr 1.15fr; gap:4mm; }
    .slide .panel { border:1px solid #dfe9e1; padding:3mm; min-width:0; overflow:hidden; }
    .slide .panel h2 { margin:0 0 2mm; font-size:14px; color:#284c35; }
    .slide .panel p { margin:0 0 2mm; font-size:10px; color:#5f7064; }
    .slide .severity { display:flex; align-items:center; height:38mm; gap:3mm; }
    .slide .severity svg { width:35mm; height:35mm; flex:none; }
    .slide .severity-legend { display:grid; gap:5px; font-size:11px; }
    .slide .severity-legend i { display:inline-block; width:9px; height:9px; margin-right:4px; }
    .slide .severity-legend small { color:#6b796e; }
    .slide .bars { display:flex; flex-direction:column; gap:2mm; }
    .slide .bar-row { display:grid; grid-template-columns:minmax(0, 1fr) 1fr auto; align-items:center; gap:2mm; font-size:10px; min-height:7mm; }
    .slide .bar-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .slide .bar-track { min-width:0; height:6mm; background:#edf2ed; }
    .slide .bar-fill { display:block; height:100%; background:#4d9d65; }
    .slide .empty { color:#68776c; }
    .slide footer { border-top:1px solid #dfe9e1; padding-top:2mm; color:#607165; font-size:9px; }
    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  </style><main class="slide">
    <header><div><h1>Fechamento mensal · ${safe(monthLabel)}</h1>
      <p>Empresa: ${safe(data.company)} · Projeto / local: ${safe(data.project)}</p>
      <p>Área: ${safe(data.area)} · Formulário: ${safe(data.form)}</p></div>
      ${branding.logoDataUrl ? `<img src="${safe(branding.logoDataUrl)}" alt="Logo da empresa">` : ''}
    </header>
    <section class="cards">${cards.map(([label, value]) => `<div class="card"><span>${safe(label)}</span><strong>${safe(value)}</strong></div>`).join('')}</section>
    <section class="grid">
      <article class="panel"><h2>Severidade dos desvios</h2><p>Percentual sobre desvios com severidade informada</p>${severityChart(data.severity)}</article>
      <article class="panel"><h2>Desvios por categoria</h2><p>Quantidades no recorte selecionado</p>${barChart(data.categories)}</article>
      <article class="panel"><h2>Detalhe por item</h2><p>Categoria: ${safe(data.selectedCategory)}</p>${barChart(data.items)}</article>
    </section>
    <footer>Resumo do recorte selecionado · IDS médio considera avaliações com resultado disponível. Barras: cinco maiores e demais agrupados em Outros.</footer>
  </main>`
  return { title, content }
}
