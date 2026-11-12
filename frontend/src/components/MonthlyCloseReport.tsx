import { useEffect, useState } from 'react'
import { Activity, BarChart3, FileDown, UsersRound } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { apiRequest, type DataConsolidation, type InspectionScope, inspectionScopeQuery } from '../lib/api'
import { IndicatorResult } from './IndicatorResult'
import { formatPercent, severityWithPercentages } from '../lib/severityChart'
import { formatIds } from '../lib/indicatorFormat'
import { monthlyClosePdf } from '../lib/monthlyClosePdf'
import { openPrintWindow } from '../lib/pdf'

const severityColors = ['#70a681', '#d2a052', '#bd6963']
const categoryColors = ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#8064a2', '#4bacc6']
const weekdayLabels = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

type MonthlyGroup = DataConsolidation['monthlyGroups'][number]

function monthRange(month: string) {
  const finalDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  return { from: `${month}-01`, to: `${month}-${String(finalDay).padStart(2, '0')}` }
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function companyKey(group: MonthlyGroup) {
  return group.contractorId ?? group.contractor ?? 'unknown-company'
}

function projectKey(group: MonthlyGroup) {
  return `${group.siteId ?? 'unknown-site'}:${group.projectOrIsland ?? ''}:${group.site ?? ''}`
}

function sumGroups(groups: MonthlyGroup[], pick: (group: MonthlyGroup) => number) {
  return groups.reduce((sum, group) => sum + pick(group), 0)
}

function groupIdentity(group: MonthlyGroup) {
  return `${companyKey(group)}|${projectKey(group)}`
}

export function MonthlyCloseReport({ month, scope }: { month: string; scope: InspectionScope }) {
  const [data, setData] = useState<DataConsolidation | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const [loadError, setLoadError] = useState<{ key: string; message: string } | null>(null)
  const [selectedCompany, setSelectedCompany] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [exportError, setExportError] = useState('')
  const query = inspectionScopeQuery(scope)
  const requestKey = `${month}:${query}`

  useEffect(() => {
    let active = true
    const parameters = new URLSearchParams(monthRange(month))
    apiRequest<DataConsolidation>(`/api/dashboard/data?${parameters}&${query}`)
      .then(result => {
        if (active) setData(result)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setData(null)
          setLoadError({
            key: requestKey,
            message: loadError instanceof Error ? loadError.message : 'Não foi possível carregar o fechamento mensal.',
          })
        }
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey)
      })
    return () => { active = false }
  }, [month, query, requestKey])

  const groups = data?.monthlyGroups ?? []
  const companies = [...new Map(groups.map(group => [companyKey(group), group.contractor ?? 'Empresa não informada'])).entries()]
    .sort((left, right) => left[1].localeCompare(right[1], 'pt-BR'))
  const activeCompany = companies.some(([key]) => key === selectedCompany) ? selectedCompany : ''
  const companyGroups = activeCompany ? groups.filter(group => companyKey(group) === activeCompany) : groups
  const projects = [...new Map(companyGroups.map(group => [projectKey(group), group.projectOrIsland ?? group.site ?? 'Projeto não informado'])).entries()]
    .sort((left, right) => left[1].localeCompare(right[1], 'pt-BR'))
  const activeProject = projects.some(([key]) => key === selectedProject) ? selectedProject : ''
  const visibleGroups = companyGroups.filter(group => !activeProject || projectKey(group) === activeProject)
  const categories = [...new Map(visibleGroups.flatMap(group => group.categories.map(category => [
    `${category.code}::${category.name}`,
    category.name,
  ] as const))).entries()]
    .sort((left, right) => left[1].localeCompare(right[1], 'pt-BR'))
  const activeCategory = categories.some(([key]) => key === selectedCategory) ? selectedCategory : categories[0]?.[0] ?? ''
  const categoryTotals = new Map<string, { name: string; quantity: number }>()
  const itemTotals = new Map<string, { name: string; quantity: number }>()
  const categoryRows = new Map<string, { name: string; values: Map<string, number> }>()
  const itemRows = new Map<string, { category: string; name: string; values: Map<string, number> }>()
  visibleGroups.forEach(group => {
    const identity = groupIdentity(group)
    group.categories.forEach(category => {
      const key = `${category.code}::${category.name}`
      const current = categoryTotals.get(key) ?? { name: category.name, quantity: 0 }
      current.quantity += category.quantity
      categoryTotals.set(key, current)
      const row = categoryRows.get(key) ?? { name: category.name, values: new Map<string, number>() }
      row.values.set(identity, (row.values.get(identity) ?? 0) + category.quantity)
      categoryRows.set(key, row)
    })
    group.items.forEach(item => {
      const key = `${item.categoryCode}::${item.code}::${item.name}`
      const row = itemRows.get(key) ?? { category: item.category, name: item.name, values: new Map<string, number>() }
      row.values.set(identity, (row.values.get(identity) ?? 0) + item.quantity)
      itemRows.set(key, row)
    })
    group.items.filter(item => `${item.categoryCode}::${item.category}` === activeCategory).forEach(item => {
      const current = itemTotals.get(item.code) ?? { name: item.name, quantity: 0 }
      current.quantity += item.quantity
      itemTotals.set(item.code, current)
    })
  })
  const sortedCategoryRows = [...categoryRows.values()].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
  const sortedItemRows = [...itemRows.values()].sort((left, right) =>
    left.category.localeCompare(right.category, 'pt-BR') || left.name.localeCompare(right.name, 'pt-BR'))
  const severityData = severityWithPercentages([
    { name: 'Baixa', quantity: sumGroups(visibleGroups, group => group.lowSeverityDeviations) },
    { name: 'Média', quantity: sumGroups(visibleGroups, group => group.mediumSeverityDeviations) },
    { name: 'Alta', quantity: sumGroups(visibleGroups, group => group.highSeverityDeviations) },
  ])
  const categoryChartData = [...categoryTotals.values()].filter(item => item.quantity > 0)
  const itemChartData = [...itemTotals.values()].filter(item => item.quantity > 0)
  const scoredEvaluationCount = sumGroups(visibleGroups, group => group.scoredEvaluationCount)
  const averageIds = scoredEvaluationCount
    ? visibleGroups.reduce((sum, group) => sum + (group.idsAverage ?? 0) * group.scoredEvaluationCount, 0) / scoredEvaluationCount
    : null
  const evaluationCount = sumGroups(visibleGroups, group => group.evaluationCount)
  const observedPeople = sumGroups(visibleGroups, group => group.observedPeople)
  const totalDeviations = sumGroups(visibleGroups, group => group.totalDeviations)
  const weightedDeviation = sumGroups(visibleGroups, group => group.weightedDeviationTotal)
  const isLoading = loadedKey !== requestKey
  const error = loadError?.key === requestKey ? loadError.message : ''

  function exportSummary() {
    setExportError('')
    const pdf = monthlyClosePdf({
      month,
      company: companies.find(([key]) => key === activeCompany)?.[1] ?? 'Todas as empresas',
      project: projects.find(([key]) => key === activeProject)?.[1] ?? 'Todos os projetos',
      area: scope.areaName,
      form: scope.formName,
      ids: averageIds,
      evaluations: evaluationCount,
      observedPeople,
      deviations: totalDeviations,
      weightedDeviation,
      severity: severityData,
      categories: categoryChartData,
      selectedCategory: categories.find(([key]) => key === activeCategory)?.[1] ?? 'Sem categoria',
      items: itemChartData,
    })
    if (!openPrintWindow(pdf.title, pdf.content)) {
      setExportError('O navegador bloqueou o PDF. Permita pop-ups para este site e tente novamente.')
    }
  }

  return <div className="monthly-close-layout">
    {error && <div className="form-error" role="alert">{error}</div>}
    {exportError && <div className="form-error" role="alert">{exportError}</div>}
    {isLoading ? <div className="indicator-empty panel" role="status">Carregando fechamento mensal…</div>
      : !groups.length ? <div className="indicator-empty panel">
        <div className="empty-line-icon"><BarChart3 size={22} /></div>
        <strong>Sem avaliações neste mês</strong>
        <span>Os resultados aparecerão aqui assim que houver avaliações para a área e o formulário selecionados.</span>
      </div>
        : <>
          <section className="metric-grid" aria-label="Resumo do fechamento mensal">
            <article className="metric-card"><p className="metric-label">IDS médio</p><strong className="metric-value"><IndicatorResult kind="ids" value={averageIds} /></strong><span className="metric-note">Média das avaliações com IDS calculado</span></article>
            <article className="metric-card"><p className="metric-label">Avaliações</p><strong className="metric-value">{evaluationCount.toLocaleString('pt-BR')}</strong><span className="metric-note">No recorte selecionado</span></article>
            <article className="metric-card"><p className="metric-label">Pessoas observadas</p><strong className="metric-value">{formatNumber(observedPeople)}</strong><span className="metric-note">Total do mês</span></article>
            <article className="metric-card"><p className="metric-label">Desvios registrados</p><strong className="metric-value">{formatNumber(totalDeviations)}</strong><span className="metric-note">Todas as severidades</span></article>
          </section>

          <section className="monthly-close-filters panel" aria-label="Filtros por empresa e projeto">
            <label>Empresa<select value={activeCompany} onChange={event => {
              setSelectedCompany(event.target.value)
              setSelectedProject('')
            }}>
              <option value="">Todas as empresas</option>
              {companies.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
            </select></label>
            <label>Projeto / local<select value={activeProject} onChange={event => setSelectedProject(event.target.value)}>
              <option value="">Todos os projetos</option>
              {projects.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
            </select></label>
            <span className="monthly-close-count"><Activity size={15} />{visibleGroups.length} combinação(ões) empresa/projeto</span>
            <button type="button" className="outline-button" onClick={exportSummary}><FileDown size={16} />PDF para apresentação</button>
          </section>

          <article className="panel data-table-panel monthly-close-table-panel">
            <div className="panel-heading"><div><h2>Fechamento por empresa e projeto</h2><p>IDS semanal e indicadores consolidados do mês selecionado.</p></div></div>
            <div className="table-scroll"><table><thead><tr>
              <th>Empresa</th><th>Projeto / local</th>{Array.from({ length: 5 }, (_, index) => <th key={index}>IDS S{index + 1}</th>)}
              <th>IDS médio</th><th>Pessoas</th><th>Desvios</th><th>Risco ponderado</th><th>Baixa</th><th>Média</th><th>Alta</th>
              <th>Baixa (%)</th><th>Média (%)</th><th>Alta (%)</th>
            </tr></thead><tbody>
              {visibleGroups.map(group => <tr key={`${companyKey(group)}:${projectKey(group)}`}>
                <td>{group.contractor ?? 'Empresa não informada'}</td>
                <td>{group.projectOrIsland ?? group.site ?? 'Projeto não informado'}</td>
                {Array.from({ length: 5 }, (_, index) => <td key={index}>{formatIds(group.weeks.find(week => week.weekNumber === index + 1)?.idsAverage)}</td>)}
                <td>{formatIds(group.idsAverage)}</td><td>{formatNumber(group.observedPeople)}</td><td>{formatNumber(group.totalDeviations)}</td>
                <td>{formatNumber(group.weightedDeviationTotal)}</td><td>{formatNumber(group.lowSeverityDeviations)}</td>
                <td>{formatNumber(group.mediumSeverityDeviations)}</td><td>{formatNumber(group.highSeverityDeviations)}</td>
                <td>{formatPercent(group.totalDeviations ? group.lowSeverityDeviations / group.totalDeviations : null)}</td>
                <td>{formatPercent(group.totalDeviations ? group.mediumSeverityDeviations / group.totalDeviations : null)}</td>
                <td>{formatPercent(group.totalDeviations ? group.highSeverityDeviations / group.totalDeviations : null)}</td>
              </tr>)}
            </tbody></table></div>
          </article>

          <section className="monthly-close-charts" aria-label="Gráficos do fechamento mensal">
            <article className="panel monthly-close-chart-panel">
              <div className="panel-heading"><div><h2>Severidade dos desvios</h2><p>Distribuição do recorte por empresa e projeto.</p></div></div>
              <div className="monthly-close-donut">
                {severityData.some(item => item.quantity > 0)
                  ? <ResponsiveContainer width="100%" height="100%"><PieChart>
                    <Pie data={severityData} dataKey="quantity" nameKey="name" innerRadius="53%" outerRadius="76%" paddingAngle={2}
                      isAnimationActive={false} labelLine={false}
                      label={({ cx, cy, index }) => {
                        const item = severityData[index]
                        if (!item || typeof cx !== 'number' || typeof cy !== 'number') return null
                        return <text x={cx} y={cy + (index - 1) * 17} textAnchor="middle" dominantBaseline="middle"
                          fill={severityColors[index]} fontSize={11} fontWeight={600}>{item.name}: {item.percentageLabel}</text>
                      }}>
                      {severityData.map((item, index) => <Cell key={item.name} fill={severityColors[index]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [formatNumber(Number(value)), 'Desvios']} />
                    <Legend />
                  </PieChart></ResponsiveContainer>
                  : <div className="monthly-close-chart-empty">Sem desvios com severidade informada.</div>}
              </div>
            </article>
            <article className="panel monthly-close-chart-panel">
              <div className="panel-heading"><div><h2>Desvios por categoria</h2><p>Distribuição dos itens observados no mês.</p></div></div>
              <div className="monthly-close-category-chart" style={{ height: Math.max(270, categoryChartData.length * 38 + 40) }}>
                {categoryChartData.length
                  ? <ResponsiveContainer width="100%" height="100%"><BarChart data={categoryChartData} layout="vertical" margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="#e8ece7" strokeDasharray="3 5" horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#858e87', fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={160} axisLine={false} tickLine={false} tick={{ fill: '#68766d', fontSize: 10 }} />
                    <Tooltip formatter={(value) => [formatNumber(Number(value)), 'Desvios']} />
                    <Bar dataKey="quantity" name="Desvios" radius={[0, 4, 4, 0]}>
                      {categoryChartData.map((item, index) => <Cell key={item.name} fill={categoryColors[index % categoryColors.length]} />)}
                    </Bar>
                  </BarChart></ResponsiveContainer>
                  : <div className="monthly-close-chart-empty">Sem itens por categoria neste recorte.</div>}
              </div>
            </article>
            <article className="panel monthly-close-chart-panel">
              <div className="panel-heading"><div><h2>Detalhe por item</h2><p>Itens da categoria selecionada.</p></div></div>
              <label className="monthly-close-category-select">Categoria<select value={activeCategory} onChange={event => setSelectedCategory(event.target.value)}>
                {categories.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
              </select></label>
              <div className="monthly-close-donut">
                {itemChartData.length
                  ? <ResponsiveContainer width="100%" height="100%"><PieChart>
                    <Pie data={itemChartData} dataKey="quantity" nameKey="name" innerRadius="48%" outerRadius="75%" paddingAngle={2}>
                      {itemChartData.map((item, index) => <Cell key={item.name} fill={categoryColors[index % categoryColors.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [formatNumber(Number(value)), 'Desvios']} />
                    <Legend />
                  </PieChart></ResponsiveContainer>
                  : <div className="monthly-close-chart-empty">Sem itens nesta categoria.</div>}
              </div>
            </article>
          </section>

          <section className="monthly-close-details" aria-label="Detalhamento mensal por empresa e projeto">
            <details className="panel monthly-close-detail">
              <summary>Pessoas observadas por dia da semana</summary>
              <div className="table-scroll"><table><thead><tr><th>Empresa</th><th>Projeto / local</th>{weekdayLabels.map(day => <th key={day}>{day}</th>)}<th>Total</th></tr></thead><tbody>
                {visibleGroups.map(group => <tr key={groupIdentity(group)}><td>{group.contractor ?? 'Empresa não informada'}</td><td>{group.projectOrIsland ?? group.site ?? 'Projeto não informado'}</td>
                  {group.weekdays.map(day => <td key={day.dayOfWeek}>{formatNumber(day.observedPeople)}</td>)}
                  <td>{formatNumber(group.weekdays.reduce((sum, day) => sum + day.observedPeople, 0))}</td>
                </tr>)}
              </tbody></table></div>
            </details>
            <details className="panel monthly-close-detail">
              <summary>Desvios observados por dia da semana</summary>
              <div className="table-scroll"><table><thead><tr><th>Empresa</th><th>Projeto / local</th>{weekdayLabels.map(day => <th key={day}>{day}</th>)}<th>Total</th></tr></thead><tbody>
                {visibleGroups.map(group => <tr key={groupIdentity(group)}><td>{group.contractor ?? 'Empresa não informada'}</td><td>{group.projectOrIsland ?? group.site ?? 'Projeto não informado'}</td>
                  {group.weekdays.map(day => <td key={day.dayOfWeek}>{formatNumber(day.totalDeviations)}</td>)}
                  <td>{formatNumber(group.weekdays.reduce((sum, day) => sum + day.totalDeviations, 0))}</td>
                </tr>)}
              </tbody></table></div>
            </details>
            <details className="panel monthly-close-detail">
              <summary>Quantidade por categoria e empresa/projeto</summary>
              {sortedCategoryRows.length
                ? <div className="table-scroll"><table><thead><tr><th>Categoria</th>{visibleGroups.map(group => <th key={groupIdentity(group)}>{group.contractor ?? 'Empresa não informada'} · {group.projectOrIsland ?? group.site ?? 'Projeto não informado'}</th>)}<th>Total</th></tr></thead><tbody>
                  {sortedCategoryRows.map(row => <tr key={row.name}><td>{row.name}</td>{visibleGroups.map(group => <td key={groupIdentity(group)}>{formatNumber(row.values.get(groupIdentity(group)) ?? 0)}</td>)}<td>{formatNumber([...row.values.values()].reduce((sum, value) => sum + value, 0))}</td></tr>)}
                </tbody></table></div>
                : <p className="monthly-close-detail-empty">Sem desvios categorizados neste recorte.</p>}
            </details>
            <details className="panel monthly-close-detail">
              <summary>Quantidade por item e empresa/projeto</summary>
              {sortedItemRows.length
                ? <div className="table-scroll"><table><thead><tr><th>Categoria</th><th>Item observado</th>{visibleGroups.map(group => <th key={groupIdentity(group)}>{group.contractor ?? 'Empresa não informada'} · {group.projectOrIsland ?? group.site ?? 'Projeto não informado'}</th>)}<th>Total</th></tr></thead><tbody>
                  {sortedItemRows.map(row => <tr key={`${row.category}:${row.name}`}><td>{row.category}</td><td>{row.name}</td>{visibleGroups.map(group => <td key={groupIdentity(group)}>{formatNumber(row.values.get(groupIdentity(group)) ?? 0)}</td>)}<td>{formatNumber([...row.values.values()].reduce((sum, value) => sum + value, 0))}</td></tr>)}
                </tbody></table></div>
                : <p className="monthly-close-detail-empty">Sem itens observados neste recorte.</p>}
            </details>
          </section>

          <div className="monthly-close-footnote"><UsersRound size={15} /><span>O IDS é calculado pela API por avaliação; a média mensal considera somente avaliações com IDS disponível. Os domingos são excluídos dos quadros semanais, seguindo a regra da planilha.</span></div>
        </>}
  </div>
}
