import { useEffect, useRef, useState, type FormEvent } from 'react'
import { calculateMonthlyIpf } from './lib/monthlyIpf'
import { formatIds, formatIdsNumber, formatIpf } from './lib/indicatorFormat'
import { indicatorStatus } from './lib/indicatorStatus'
import { IndicatorResult } from './components/IndicatorResult'
import {
  AlertTriangle,
  Activity,
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Download,
  Database,
  FileDown,
  FileBarChart,
  Filter,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Plus,
  Pencil,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { LoginScreen } from './components/LoginScreen'
import { EvaluationForm } from './components/EvaluationForm'
import { InspectionFormsEditor } from './components/InspectionFormsEditor'
import { ApiError, apiRequest, clearAccessToken, getAccessToken, type ChecklistCatalog, type DashboardSummary, type DataConsolidation, type EvaluationResult, type EvaluationSummary, type IpfAnnualHistory, type IpfMonthlySuggestion } from './lib/api'
import { evaluationPdf, monthlyIpfReportPdf, openPrintWindow, writePrintWindow } from './lib/pdf'
import { buildWorkbookCharts } from './lib/workbookReport'
import { clearBranding, defaultPrimaryColor, fetchBranding, loadBranding, readLogoFile, saveBranding, type ReportBranding } from './lib/branding'
import './ids.css'
import { InspectionScopeSelector } from './components/InspectionScopeSelector'
import { IpfCompositionReport } from './components/IpfCompositionReport'
import { MonthlyCloseReport } from './components/MonthlyCloseReport'
import { UserGuide } from './components/UserGuide'
import { OperationalCatalog } from './components/OperationalCatalog'
import { inspectionScopeQuery, type InspectionScope } from './lib/api'

type Section = 'overview' | 'evaluations' | 'data' | 'indicators' | 'reports' | 'monthlyClose' | 'catalog' | 'forms' | 'settings' | 'users' | 'account' | 'guide'

const sections: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'evaluations', label: 'Avaliações', icon: ClipboardCheck },
  { id: 'data', label: 'Dados', icon: Database },
  { id: 'indicators', label: 'Indicadores', icon: Gauge },
  { id: 'reports', label: 'Relatório IPF', icon: FileBarChart },
  { id: 'monthlyClose', label: 'Fechamento mensal', icon: BarChart3 },
]

const sectionCopy: Record<Section, { title: string; description: string }> = {
  overview: { title: 'Visão geral', description: 'Acompanhe as avaliações de segurança e os indicadores do período.' },
  evaluations: { title: 'Avaliações', description: 'Registros de observações comportamentais e condições de segurança.' },
  data: { title: 'Dados', description: 'Consolidação das avaliações por data, categoria e item observado.' },
  indicators: { title: 'Indicadores', description: 'Resultados de IDS, distribuição de desvios e evolução por período.' },
  reports: { title: 'Relatório IPF', description: 'Dados Relatório Mensal e gráficos do modelo de acompanhamento IPF.' },
  monthlyClose: { title: 'Fechamento mensal', description: 'Consolidação das fórmulas e gráficos por empresa e projeto.' },
  catalog: { title: 'Cadastros', description: 'Cadastre e consulte contratadas, locais ou projetos e áreas de inspeção.' },
  forms: { title: 'Formulários de inspeção', description: 'Crie e edite formulários completos com tópicos e itens, mantendo as regras de cálculo e o histórico das inspeções.' },
  settings: { title: 'Configurações', description: 'Cadastros e parâmetros disponíveis para o seu perfil.' },
  users: { title: 'Usuários e perfis', description: 'Crie usuários, defina perfis e controle o acesso ao sistema.' },
  account: { title: 'Minha conta', description: 'Altere sua senha de acesso ao sistema.' },
  guide: { title: 'Guia de uso', description: 'Aprenda a cadastrar, avaliar e interpretar os resultados, do primeiro acesso ao IPF.' },
}

const metrics = [
  { label: 'IDS do período', icon: Gauge, note: 'Índice de desempenho em segurança', tone: 'green' },
  { label: 'Avaliações', icon: ClipboardCheck, note: 'Registros realizados', tone: 'blue' },
  { label: 'Pessoas observadas', icon: UsersRound, note: 'Total no período', tone: 'orange' },
  { label: 'Desvios registrados', icon: Activity, note: 'Distribuídos por severidade', tone: 'red' },
]

const severityLevels = [
  { label: 'Baixa', weight: '0,3', color: 'severity-low', countKey: 'lowSeverityDeviations', shareKey: 'lowSeverityShare' },
  { label: 'Média', weight: '1', color: 'severity-medium', countKey: 'mediumSeverityDeviations', shareKey: 'mediumSeverityShare' },
  { label: 'Alta', weight: '3', color: 'severity-high', countKey: 'highSeverityDeviations', shareKey: 'highSeverityShare' },
] as const

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(month: string) {
  if (!month) return 'Período não selecionado'
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${month}-15T12:00:00`))
}

function App() {
  const [activeSection, setActiveSection] = useState<Section>('overview')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth)
  const [search, setSearch] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAccessToken()))
  const [displayName, setDisplayName] = useState('Usuário')
  const [companyName, setCompanyName] = useState('')
  const [profileError, setProfileError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [canManageCatalog, setCanManageCatalog] = useState(false)
  const [profileReady, setProfileReady] = useState(false)
  const [showEvaluationForm, setShowEvaluationForm] = useState(false)
  const [editingEvaluationId, setEditingEvaluationId] = useState<string | null>(null)
  const [evaluationRefresh, setEvaluationRefresh] = useState(0)
  const [inspectionScope, setInspectionScope] = useState<InspectionScope | null>(null)
  const [reportMode, setReportMode] = useState<'manual' | 'composition'>('manual')
  const scopeQuery = inspectionScope ? inspectionScopeQuery(inspectionScope) : ''
  const activeCopy = sectionCopy[activeSection]

  useEffect(() => {
    const handleUnauthorized = () => {
      clearBranding()
      setIsAdmin(false)
      setCanManageCatalog(false)
      setProfileReady(false)
      setShowEvaluationForm(false)
      setActiveSection('overview')
      setIsAuthenticated(false)
    }
    window.addEventListener('ids:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('ids:unauthorized', handleUnauthorized)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    let active = true
    Promise.all([
      apiRequest<{ displayName: string; companyName: string; roles: string[] }>('/api/auth/me'),
      fetchBranding(),
    ]).then(([me]) => {
      if (!active) return
      setDisplayName(me.displayName || 'Usuário')
      setCompanyName(me.companyName)
      setIsAdmin(me.roles.includes('ADMINISTRADOR'))
      setCanManageCatalog(me.roles.some(role => role === 'ADMINISTRADOR' || role === 'GESTOR'))
      setProfileReady(true)
    }).catch(error => {
      if (active) setProfileError(error instanceof Error ? error.message : 'Não foi possível carregar sua empresa.')
    })
    return () => { active = false }
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return <LoginScreen onAuthenticated={(name) => { setDisplayName(name); setProfileError(''); setProfileReady(false); setIsAuthenticated(true) }} />
  }

  if (profileError) {
    return <div className="app-loading"><p role="alert">{profileError}</p><button type="button" onClick={() => { clearAccessToken(); clearBranding(); setProfileError(''); setIsAuthenticated(false) }}>Voltar ao login</button></div>
  }

  if (!profileReady) {
    return <div className="app-loading" role="status">Carregando…</div>
  }

  function signOut() {
    clearAccessToken()
    clearBranding()
    setCompanyName('')
    setProfileError('')
    setProfileReady(false)
    setShowEvaluationForm(false)
    setIsAdmin(false)
    setCanManageCatalog(false)
    setIsAuthenticated(false)
    setActiveSection('overview')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => setActiveSection('overview')}>
          <span className="brand-mark"><ShieldCheck size={22} strokeWidth={2.2} /></span>
          <span className="brand-copy"><strong>IDS</strong><small>Segurança operacional</small></span>
        </a>

        <div className="workspace-switcher">
          <span className="workspace-avatar">{companyName.slice(0, 1).toUpperCase()}</span>
          <span className="workspace-copy"><strong>{companyName}</strong><small>Sua empresa</small></span>
          <ChevronDown size={15} aria-hidden="true" />
        </div>

        <nav className="primary-nav" aria-label="Navegação principal">
          <span className="nav-caption">GESTÃO</span>
          {sections.map(({ id, label, icon: Icon }) => (
            <button className={`nav-link ${id === 'data' || id === 'reports' ? 'workbook-nav' : ''} ${activeSection === id ? 'active' : ''}`} key={id} onClick={() => setActiveSection(id)} type="button">
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === 'evaluations' && <span className="nav-indicator" aria-label="Sem avaliações" />}
            </button>
          ))}
          {canManageCatalog && <button className={`nav-link ${activeSection === 'catalog' ? 'active' : ''}`} onClick={() => { setShowEvaluationForm(false); setActiveSection('catalog') }} type="button">
            <Database size={18} strokeWidth={1.8} /><span>Cadastros</span>
          </button>}
          {isAdmin && <>
          <span className="nav-caption nav-caption-lower">ADMINISTRAÇÃO</span>
          <button className={`nav-link ${activeSection === 'forms' ? 'active' : ''}`} onClick={() => { setShowEvaluationForm(false); setActiveSection('forms') }} type="button">
            <ListChecks size={18} strokeWidth={1.8} /><span>Formulários de inspeção</span>
          </button>
          <button className={`nav-link ${activeSection === 'settings' ? 'active' : ''}`} onClick={() => setActiveSection('settings')} type="button">
            <Settings2 size={18} strokeWidth={1.8} /><span>Configurações</span>
          </button>
          <button className={`nav-link ${activeSection === 'users' ? 'active' : ''}`} onClick={() => setActiveSection('users')} type="button">
            <UsersRound size={18} strokeWidth={1.8} /><span>Usuários e perfis</span>
          </button>
          </>}
          <button className={`nav-link ${activeSection === 'guide' ? 'active' : ''}`} onClick={() => { setShowEvaluationForm(false); setActiveSection('guide') }} type="button">
            <BookOpen size={18} strokeWidth={1.8} /><span>Guia de uso</span>
          </button>
          <button className={`nav-link ${activeSection === 'account' ? 'active' : ''}`} onClick={() => { setShowEvaluationForm(false); setActiveSection('account') }} type="button">
            <UserRound size={18} strokeWidth={1.8} /><span>Minha conta</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="security-note"><span className="status-dot" /> Ambiente preparado</div>
          <button className="user-menu" type="button" aria-label="Sair do sistema" onClick={signOut}>
            <span className="user-avatar"><UserRound size={17} /></span>
            <span className="user-copy"><strong>{displayName}</strong><small>Encerrar sessão</small></span>
            <ArrowRight size={15} />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>IDS</span><span className="breadcrumb-slash">/</span><strong>{activeCopy.title}</strong></div>
          <div className="topbar-actions">
            <label className="search-field">
              <Search size={16} />
              <input aria-label="Buscar avaliações e relatórios" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar registros" value={search} />
              <kbd>⌘ K</kbd>
            </label>
            <button className="profile-button" type="button" aria-label="Sair do sistema" onClick={signOut}><span className="profile-initial">{displayName.slice(0, 1).toUpperCase()}</span><ChevronDown size={14} /></button>
          </div>
        </header>

        <div className="page-content">
          {showEvaluationForm ? (
            <EvaluationForm
              initialScope={inspectionScope ?? undefined}
              evaluationId={editingEvaluationId ?? undefined}
              canCreateCatalog={canManageCatalog}
              onClose={() => setShowEvaluationForm(false)}
              onCreated={() => {
                setShowEvaluationForm(false)
                setEditingEvaluationId(null)
                setActiveSection('evaluations')
                setEvaluationRefresh((revision) => revision + 1)
              }}
            />
          ) : <>
          <div className="page-heading">
            <div><p className="eyebrow">PAINEL DE SEGURANÇA</p><h1>{activeCopy.title}</h1><p className="page-description">{activeCopy.description}</p></div>
            {activeSection !== 'guide' && <div className="heading-actions">
              <label className="period-control"><CalendarDays size={17} /><span>Mês de referência</span><input aria-label="Selecionar mês de referência" onChange={(event) => { if (event.target.value) setSelectedMonth(event.target.value) }} type="month" value={selectedMonth} /></label>
              {(activeSection === 'evaluations' || activeSection === 'forms') && <button className="secondary-button" type="button" onClick={() => { setEditingEvaluationId(null); setActiveSection('evaluations'); setShowEvaluationForm(true) }}><Plus size={17} /> Nova avaliação</button>}
            </div>}
          </div>

          {activeSection === 'reports' && <div className="ipf-report-modes" role="group" aria-label="Tipo de relatório IPF">
            <button type="button" className={reportMode === 'manual' ? 'primary-button' : 'outline-button'} aria-pressed={reportMode === 'manual'} onClick={() => setReportMode('manual')}>IPF manual por formulário</button>
            <button type="button" className={reportMode === 'composition' ? 'primary-button' : 'outline-button'} aria-pressed={reportMode === 'composition'} onClick={() => setReportMode('composition')}>IPF por disciplinas e pesos</button>
          </div>}
          {['overview', 'evaluations', 'data', 'indicators', 'reports', 'monthlyClose'].includes(activeSection)
            && !(activeSection === 'reports' && reportMode === 'composition') && <InspectionScopeSelector key={activeSection} onChange={setInspectionScope} includeOrganizationFilters={activeSection === 'overview' || activeSection === 'indicators'} />}
          {inspectionScope && activeSection === 'overview' && <Dashboard key={scopeQuery} scopeQuery={scopeQuery} month={selectedMonth} monthLabel={formatMonth(selectedMonth)} onOpenEvaluations={() => setActiveSection('evaluations')} />}
          {inspectionScope && activeSection === 'evaluations' && <Evaluations scopeQuery={scopeQuery} key={`${evaluationRefresh}-${scopeQuery}`} search={search} month={selectedMonth} onCreate={() => { setEditingEvaluationId(null); setShowEvaluationForm(true) }} onEdit={(id) => { setEditingEvaluationId(id); setShowEvaluationForm(true) }} />}
          {inspectionScope && activeSection === 'data' && <DataView key={scopeQuery} scopeQuery={scopeQuery} month={selectedMonth} />}
          {inspectionScope && activeSection === 'monthlyClose' && <MonthlyCloseReport key={scopeQuery} scope={inspectionScope} month={selectedMonth} />}
          {inspectionScope && activeSection === 'indicators' && <Indicators key={scopeQuery} scopeQuery={scopeQuery} month={selectedMonth} monthLabel={formatMonth(selectedMonth)} />}
          {inspectionScope && activeSection === 'reports' && reportMode === 'manual' && <Reports key={scopeQuery} scope={inspectionScope} month={selectedMonth} monthLabel={formatMonth(selectedMonth)} />}
          {activeSection === 'reports' && reportMode === 'composition' && <IpfCompositionReport month={selectedMonth} initialAreaId={inspectionScope?.areaId} />}
          {activeSection === 'catalog' && canManageCatalog && <OperationalCatalog canCreateArea={isAdmin} />}
          {activeSection === 'forms' && isAdmin && <InspectionFormsEditor />}
          {activeSection === 'settings' && isAdmin && <SettingsView />}
          {activeSection === 'users' && isAdmin && <div className="settings-grid"><UsersAdmin /></div>}
          {activeSection === 'account' && <div className="settings-grid"><AccountPassword /></div>}
          {activeSection === 'guide' && <UserGuide />}

          <footer className="page-footer"><span>IDS <span className="footer-divider">·</span> Gestão de segurança</span><span>Regras de cálculo centralizadas na API</span></footer>
          </>}
        </div>
      </main>
    </div>
  )
}

function Dashboard({ month, monthLabel, onOpenEvaluations, scopeQuery }: { month: string; monthLabel: string; onOpenEvaluations: () => void; scopeQuery: string }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [consolidation, setConsolidation] = useState<DataConsolidation | null>(null)
  const [summaryError, setSummaryError] = useState('')
  const [isLoadingSummary, setIsLoadingSummary] = useState(true)

  useEffect(() => {
    let isCurrent = true
    const parameters = new URLSearchParams()
    if (month) {
      parameters.set('from', `${month}-01`)
      const finalDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
      parameters.set('to', `${month}-${String(finalDay).padStart(2, '0')}`)
    }

    setIsLoadingSummary(true)
    setSummaryError('')
    const query = parameters.toString()
    Promise.all([
      apiRequest<DashboardSummary>(`/api/dashboard/summary?${query}&${scopeQuery}`),
      apiRequest<DataConsolidation>(`/api/dashboard/data?${query}&${scopeQuery}`),
    ])
      .then(([result, details]) => {
        if (isCurrent) {
          setSummary(result)
          setConsolidation(details)
        }
      })
      .catch((error: unknown) => { if (isCurrent) setSummaryError(error instanceof Error ? error.message : 'Não foi possível carregar os indicadores.') })
      .finally(() => { if (isCurrent) setIsLoadingSummary(false) })

    return () => { isCurrent = false }
  }, [month, scopeQuery])

  const metricValues = [
    formatIds(summary?.ids),
    summary?.evaluationCount.toLocaleString('pt-BR') ?? '—',
    summary?.observedPeopleTotal?.toLocaleString('pt-BR') ?? '—',
    summary?.totalDeviations.toLocaleString('pt-BR') ?? '—',
  ]
  const severityChartData = severityLevels.map((level) => {
    const share = summary?.[level.shareKey]
    return {
      name: level.label,
      percentage: share == null ? 0 : share * 100,
      color: level.color === 'severity-low' ? '#77a989' : level.color === 'severity-medium' ? '#d29b54' : '#bf6963',
    }
  })
  const hasSeverityData = severityChartData.some((level) => level.percentage > 0)

  return (
    <>
      <div className="period-ribbon">
        <span className="period-icon"><CalendarDays size={16} /></span><span>Período de referência</span><strong>{monthLabel}</strong>
        <span className="period-separator" /><span className="period-state"><span className="status-dot" />{summary ? `${summary.evaluationCount} avaliações no período` : isLoadingSummary ? 'Carregando consolidação' : 'Sem avaliações registradas'}</span>
      </div>

      <section className="metric-grid" aria-label="Indicadores do período">
        {metrics.map(({ label, icon: Icon, note, tone }, index) => (
          <article className="metric-card" key={label}>
            <div className="metric-topline"><span className={`metric-icon ${tone}`}><Icon size={18} strokeWidth={1.9} /></span><span className="metric-index">0{index + 1}</span></div>
            <p className="metric-label">{label}</p><strong className="metric-value">{isLoadingSummary ? '…' : index === 0 ? <IndicatorResult kind="ids" value={summary?.ids} /> : metricValues[index]}</strong><span className="metric-note">{index === 0 ? 'Consolidação mensal pendente de regra validada' : note}</span>
          </article>
        ))}
      </section>

      {summaryError && <div className="dashboard-error" role="status">{summaryError}</div>}

      <section className="dashboard-charts-grid" aria-label="Gráficos de indicadores do período">
        <article className="panel dashboard-chart-panel">
          <div className="panel-heading"><div><div className="panel-title-line"><h2>Evolução do IDS por avaliação</h2><span className="unit-tag">%</span></div><p>Notas diárias calculadas no período de {monthLabel}.</p></div><button className="quiet-button" type="button" aria-label="Filtrar evolução"><Filter size={16} /></button></div>
          <div className="chart-area">
            {summary?.trend.some(point => point.ids !== null) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summary.trend.filter((point) => point.ids !== null)} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                  <defs><linearGradient id="idsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2f7256" stopOpacity={0.2} /><stop offset="95%" stopColor="#2f7256" stopOpacity={0.01} /></linearGradient></defs>
                  <CartesianGrid stroke="#e8ece7" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#858e87', fontSize: 10 }} tickFormatter={(value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${value}T12:00:00`))} />
                  <YAxis domain={['dataMin', 'dataMax']} axisLine={false} tickLine={false} tick={{ fill: '#858e87', fontSize: 10 }} tickFormatter={(value: number) => formatIds(value)} />
                  <Tooltip labelFormatter={(value) => new Intl.DateTimeFormat('pt-BR').format(new Date(`${String(value)}T12:00:00`))} formatter={(value) => [<IndicatorResult key="ids" kind="ids" value={Number(value)} />, 'IDS']} />
                  <Area type="monotone" dataKey="ids" stroke="#2f7256" strokeWidth={2.5} fill="url(#idsFill)" connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <DashboardChartEmpty isLoading={isLoadingSummary} />}
          </div>
          <div className="chart-footer"><span><i className="legend-dot" /> IDS por avaliação</span><span>Fonte: avaliações do período</span></div>
        </article>

        <article className="panel dashboard-chart-panel">
          <div className="panel-heading"><div><h2>Pessoas observadas</h2><p>Total por data de avaliação.</p></div></div>
          <div className="chart-area">
            {consolidation?.days.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={consolidation.days} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#e8ece7" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#858e87', fontSize: 10 }} tickFormatter={(value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${value}T12:00:00`))} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#858e87', fontSize: 10 }} />
                  <Tooltip labelFormatter={(value) => new Intl.DateTimeFormat('pt-BR').format(new Date(`${String(value)}T12:00:00`))} formatter={(value) => [Number(value).toLocaleString('pt-BR'), 'Pessoas observadas']} />
                  <Bar dataKey="observedPeople" fill="#4c7183" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <DashboardChartEmpty isLoading={isLoadingSummary} />}
          </div>
          <div className="chart-footer"><span><i className="legend-dot" style={{ background: '#4c7183' }} /> Pessoas observadas</span><span>Fonte: avaliações do período</span></div>
        </article>

        <article className="panel dashboard-chart-panel">
          <div className="panel-heading"><div><h2>Desvios registrados</h2><p>Quantidade por data de avaliação.</p></div></div>
          <div className="chart-area">
            {consolidation?.days.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={consolidation.days} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#e8ece7" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#858e87', fontSize: 10 }} tickFormatter={(value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${value}T12:00:00`))} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#858e87', fontSize: 10 }} />
                  <Tooltip labelFormatter={(value) => new Intl.DateTimeFormat('pt-BR').format(new Date(`${String(value)}T12:00:00`))} formatter={(value) => [Number(value).toLocaleString('pt-BR'), 'Desvios registrados']} />
                  <Bar dataKey="totalDeviations" fill="#a44c4b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <DashboardChartEmpty isLoading={isLoadingSummary} />}
          </div>
          <div className="chart-footer"><span><i className="legend-dot" style={{ background: '#a44c4b' }} /> Desvios registrados</span><span>Pesos válidos: 0,3 · 1 · 3</span></div>
        </article>

        <article className="panel dashboard-chart-panel">
          <div className="panel-heading"><div><h2>Desvios por grau de severidade</h2><p>Participação percentual no total do período.</p></div></div>
          <div className="chart-area">
            {hasSeverityData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityChartData} layout="vertical" margin={{ top: 12, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#e8ece7" strokeDasharray="3 5" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#858e87', fontSize: 10 }} tickFormatter={(value: number) => `${value}%`} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={58} tick={{ fill: '#68766d', fontSize: 10 }} />
                  <Tooltip formatter={(value) => [`${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, 'Participação']} />
                  <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                    {severityChartData.map((level) => <Cell key={level.name} fill={level.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <DashboardChartEmpty isLoading={isLoadingSummary} />}
          </div>
          <div className="chart-footer"><span><i className="legend-dot" /> Percentual dos desvios</span><span>Baixa · média · alta</span></div>
        </article>

        <article className="panel dashboard-chart-panel dashboard-category-panel">
          <div className="panel-heading"><div><h2>Desvios por categoria</h2><p>Quantidade observada em cada categoria no período.</p></div></div>
          <div className="chart-area">
            {consolidation?.categories.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={consolidation.categories} layout="vertical" margin={{ top: 8, right: 20, left: 12, bottom: 8 }}>
                  <CartesianGrid stroke="#e8ece7" strokeDasharray="3 5" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#858e87', fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={150} tick={{ fill: '#68766d', fontSize: 10 }} />
                  <Tooltip formatter={(value) => [Number(value).toLocaleString('pt-BR'), 'Desvios']} />
                  <Bar dataKey="quantity" fill="#3d7655" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <DashboardChartEmpty isLoading={isLoadingSummary} />}
          </div>
          <div className="chart-footer"><span><i className="legend-dot" style={{ background: '#3d7655' }} /> Quantidade por categoria</span><span>Fonte: avaliações do período</span></div>
        </article>
      </section>

      <section className="bottom-grid">
        <article className="panel activity-panel">
          <div className="panel-heading"><div><h2>Avaliações recentes</h2><p>Últimos registros lançados no sistema.</p></div><button className="text-button" type="button" onClick={onOpenEvaluations}>Ver avaliações <ArrowRight size={15} /></button></div>
          <RecentEvaluations month={month} scopeQuery={scopeQuery} />
        </article>
        <aside className="focus-note">
          <div className="focus-note-top"><span><ArrowDownRight size={17} /></span><small>ACOMPANHAMENTO</small></div>
          <h2>Foco em observações completas</h2><p>Registre quantidade, severidade e contexto da observação para manter os indicadores consistentes.</p>
          <button type="button" onClick={onOpenEvaluations}>Abrir avaliações <ArrowRight size={15} /></button><div className="focus-watermark"><ShieldCheck size={92} strokeWidth={0.8} /></div>
        </aside>
      </section>
    </>
  )
}

function DashboardChartEmpty({ isLoading }: { isLoading: boolean }) {
  return <div className="dashboard-chart-empty">{isLoading ? 'Carregando dados do período…' : 'Sem dados para o período selecionado.'}</div>
}

function RecentEvaluations({ month, scopeQuery }: { month: string; scopeQuery: string }) {
  const [evaluations, setEvaluations] = useState<EvaluationSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isCurrent = true
    const finalDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
    const parameters = new URLSearchParams({ from: `${month}-01`, to: `${month}-${String(finalDay).padStart(2, '0')}` })
    apiRequest<EvaluationSummary[]>(`/api/evaluations?${parameters}&${scopeQuery}`)
      .then((result) => { if (isCurrent) setEvaluations(result.slice(0, 4)) })
      .catch(() => { if (isCurrent) setHasError(true) })
      .finally(() => { if (isCurrent) setIsLoading(false) })

    return () => { isCurrent = false }
  }, [month, scopeQuery])

  if (isLoading) return <div className="table-empty">Carregando avaliações…</div>
  if (hasError) return <div className="table-empty"><strong>Não foi possível carregar os registros</strong><span>Verifique a conexão com a API.</span></div>
  if (evaluations.length === 0) return <div className="table-empty"><div className="empty-line-icon"><ListChecks size={20} /></div><strong>Nenhuma avaliação neste período</strong><span>Quando houver registros, eles serão listados aqui.</span></div>

  return <div className="recent-evaluations">{evaluations.map((evaluation) => <div className="recent-evaluation-row" key={evaluation.id}><span className="recent-date">{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${evaluation.evaluationDate}T12:00:00`))}</span><span className="recent-main"><strong>{evaluation.site ?? evaluation.contractor ?? 'Avaliação operacional'}</strong><small>{evaluation.leadAuditorName ?? 'Avaliador não informado'}</small></span><span className="recent-score"><IndicatorResult kind="ids" value={evaluation.indicators.ids} /></span></div>)}</div>
}

const reportWeekdays = [
  { index: 1, label: 'Segunda' },
  { index: 2, label: 'Terça' },
  { index: 3, label: 'Quarta' },
  { index: 4, label: 'Quinta' },
  { index: 5, label: 'Sexta' },
  { index: 6, label: 'Sábado' },
]

function weeklyDayMatrix(
  days: DataConsolidation['weekdays'],
  selectValue: (day: DataConsolidation['weekdays'][number]) => number,
) {
  return reportWeekdays.map(({ index, label }) => {
    const values = Array.from({ length: 5 }, (_, week) => days
      .filter(day => day.dayOfWeek === index && day.weekNumber === week + 1)
      .reduce((sum, day) => sum + selectValue(day), 0))
    return { label, values, total: values.reduce((sum, value) => sum + value, 0) }
  })
}

function reportWeekIndex(date: string) {
  return Math.floor((Number(date.slice(8, 10)) - 1) / 7)
}

function DataView({ month, scopeQuery }: { month: string; scopeQuery: string }) {
  const [catalog, setCatalog] = useState<ChecklistCatalog | null>(null)
  const [contractorId, setContractorId] = useState('')
  const [siteId, setSiteId] = useState('')
  const [data, setData] = useState<DataConsolidation | null>(null)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest<ChecklistCatalog>('/api/catalog')
      .then((result) => setCatalog(result))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as contratadas.'))
      .finally(() => setIsLoadingCatalog(false))
  }, [])

  useEffect(() => {
    if (!contractorId) {
      setData(null)
      setIsLoadingData(false)
      return
    }

    let isCurrent = true
    const endDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
    const query = new URLSearchParams({
      from: `${month}-01`,
      to: `${month}-${String(endDay).padStart(2, '0')}`,
      contractorId,
    })
    if (siteId) query.set('siteId', siteId)
    setIsLoadingData(true)
    setError('')
    apiRequest<DataConsolidation>(`/api/dashboard/data?${query}&${scopeQuery}`)
      .then((result) => {
        if (!isCurrent) return
        setData(result)
      })
      .catch((loadError: unknown) => { if (isCurrent) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os dados consolidados.') })
      .finally(() => { if (isCurrent) setIsLoadingData(false) })
    return () => { isCurrent = false }
  }, [contractorId, siteId, month, scopeQuery])

  const weekdays = data?.weekdays ?? []
  const weekdayIds = reportWeekdays.map(({ index, label }) => ({
    label,
    values: Array.from({ length: 5 }, (_, week) => weekdays.find(day => day.dayOfWeek === index && day.weekNumber === week + 1)?.ids ?? null),
  }))
  const weeklyIds = [
    ...weekdayIds,
    {
      label: 'Média',
      values: Array.from({ length: 5 }, (_, week) => {
        const values = weekdayIds.flatMap(row => {
          const value = row.values[week]
          return value === null ? [] : [value]
        })
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
      }),
    },
  ]
  const weeklyObservationRows = (() => {
    const rows = new Map<string, { category: string; item: string; values: number[] }>()
    data?.weeklyItems.forEach(item => {
      const week = item.weekNumber - 1
      if (week < 0 || week >= 5) return
      const key = `${item.categoryCode}\u0000${item.code}`
      const row = rows.get(key) ?? { category: item.category, item: item.name, values: Array.from({ length: 5 }, () => 0) }
      row.values[week] += item.quantity
      rows.set(key, row)
    })
    return [...rows.values()].sort((left, right) => left.category.localeCompare(right.category, 'pt-BR') || left.item.localeCompare(right.item, 'pt-BR'))
  })()
  const weeklyCategoryRows = (() => {
    const rows = new Map<string, { code: string; values: number[] }>()
    data?.weeklyCategories.forEach(category => {
      const week = category.weekNumber - 1
      if (week < 0 || week >= 5) return
      const row = rows.get(category.code) ?? { code: category.name, values: Array.from({ length: 5 }, () => 0) }
      row.values[week] += category.quantity
      rows.set(category.code, row)
    })
    return [...rows.values()].sort((left, right) => left.code.localeCompare(right.code, 'pt-BR'))
  })()
  const weeklySeverityRows = [
    { label: 'Baixa · 0,3', weight: 0.3 },
    { label: 'Média · 1', weight: 1 },
    { label: 'Alta · 3', weight: 3 },
  ].map(level => {
    const values = Array.from({ length: 5 }, () => 0)
    weekdays.forEach(day => {
      const week = day.weekNumber - 1
      if (week < 0 || week >= values.length) return
      const quantity = level.weight === 0.3 ? day.lowSeverityDeviations
        : level.weight === 1 ? day.mediumSeverityDeviations
          : day.highSeverityDeviations
      values[week] += quantity
    })
    return { label: level.label, values, total: values.reduce((sum, value) => sum + value, 0) }
  })
  const reportDays = data?.days.filter(day => new Date(`${day.date}T12:00:00`).getDay() !== 0) ?? []
  const reportCategories = weeklyCategoryRows.map(row => ({
    code: row.code,
    name: row.code,
    quantity: row.values.reduce((sum, value) => sum + value, 0),
  }))
  const reportItems = weeklyObservationRows.map(row => ({
    categoryCode: row.category,
    category: row.category,
    code: row.item,
    name: row.item,
    quantity: row.values.reduce((sum, value) => sum + value, 0),
  }))
  const reportData: DataConsolidation | null = data ? {
    ...data,
    evaluationCount: weekdays.reduce((sum, day) => sum + day.evaluationCount, 0),
    observedPeople: weekdays.reduce((sum, day) => sum + day.observedPeople, 0),
    totalDeviations: weeklySeverityRows.reduce((sum, row) => sum + row.total, 0),
    weightedDeviationTotal: weeklySeverityRows.reduce((sum, row) => {
      const weight = row.label === 'Baixa · 0,3' ? 0.3 : row.label === 'Média · 1' ? 1 : 3
      return sum + row.total * weight
    }, 0),
    lowSeverityDeviations: weeklySeverityRows[0].total,
    mediumSeverityDeviations: weeklySeverityRows[1].total,
    highSeverityDeviations: weeklySeverityRows[2].total,
    days: reportDays,
    categories: reportCategories,
    items: reportItems,
    weekGroupingStatus: data.weekGroupingStatus,
  } : null
  const severityData = reportData ? [
    { name: 'Baixa · 0,3', total: reportData.lowSeverityDeviations, fill: '#77a989' },
    { name: 'Média · 1', total: reportData.mediumSeverityDeviations, fill: '#d29b54' },
    { name: 'Alta · 3', total: reportData.highSeverityDeviations, fill: '#bf6963' },
  ] : []
  const weeklyMetrics = reportData ? [
    { title: 'Pessoas observadas', selectValue: (day: DataConsolidation['weekdays'][number]) => day.observedPeople },
    { title: 'Desvios registrados', selectValue: (day: DataConsolidation['weekdays'][number]) => day.totalDeviations },
    { title: 'Desvio ponderado (SD)', selectValue: (day: DataConsolidation['weekdays'][number]) => day.weightedDeviationTotal },
    { title: 'Avaliações', selectValue: (day: DataConsolidation['weekdays'][number]) => day.evaluationCount },
  ].map(metric => ({ ...metric, rows: weeklyDayMatrix(reportData.weekdays, metric.selectValue) })) : []

  return (
    <div className="data-view">
      <div className="data-filter-row">
        <label>Contratada<select disabled={isLoadingCatalog} onChange={(event) => setContractorId(event.target.value)} value={contractorId}><option value="">Selecionar contratada</option>{catalog?.organizations.filter((organization) => organization.kind === 'Contractor').map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
        <label>Local / projeto<select disabled={isLoadingCatalog} value={siteId} onChange={event => setSiteId(event.target.value)}><option value="">Todos os projetos</option>{catalog?.sites.map(site => <option key={site.id} value={site.id}>{site.name}{!site.isActive ? ' (desativado)' : ''}</option>)}</select></label>
        <span className="data-period-label">Período: {formatMonth(month)}</span>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {!contractorId && !isLoadingCatalog && <div className="data-prompt panel"><div className="empty-line-icon"><Database size={20} /></div><strong>Selecione uma contratada</strong><span>A consolidação será carregada para uma empresa por vez.</span></div>}
      {isLoadingData && <div className="form-loading">Carregando consolidação…</div>}
      {reportData && <>
        <div className="period-ribbon"><span className="period-icon"><CalendarDays size={16} /></span><span>{formatMonth(month)}</span><strong>{reportData.evaluationCount} avaliações</strong></div>
        <section className="metric-grid data-metric-grid" aria-label="Totais consolidados">
          <article className="metric-card"><p className="metric-label">Pessoas observadas</p><strong className="metric-value">{reportData.observedPeople.toLocaleString('pt-BR')}</strong><span className="metric-note">Soma das avaliações no período</span></article>
          <article className="metric-card"><p className="metric-label">Desvios</p><strong className="metric-value">{reportData.totalDeviations.toLocaleString('pt-BR')}</strong><span className="metric-note">Pesos válidos 0,3 · 1 · 3</span></article>
          <article className="metric-card"><p className="metric-label">Desvio ponderado (SD)</p><strong className="metric-value">{reportData.weightedDeviationTotal.toLocaleString('pt-BR')}</strong><span className="metric-note">Quantidade × severidade</span></article>
          <article className="metric-card"><p className="metric-label">Avaliações</p><strong className="metric-value">{reportData.evaluationCount.toLocaleString('pt-BR')}</strong><span className="metric-note">Rascunhos e enviadas</span></article>
        </section>
        <div className="data-validation-note"><AlertTriangle size={16} /><span>{reportData.weekGroupingStatus}</span></div>
        <section className="data-week-grid" aria-label="Consolidação por semana e dia">
          {weeklyMetrics.map(metric => <article className="panel data-table-panel" key={metric.title}>
            <div className="panel-heading"><div><h2>{metric.title} por semana</h2><p>Distribuição de segunda a sábado, conforme a planilha.</p></div></div>
            <div className="table-scroll"><table><thead><tr><th>Dia</th>{Array.from({ length: 5 }, (_, index) => <th key={index}>S{index + 1}</th>)}<th>Total</th></tr></thead>
              <tbody>{metric.rows.map(row => <tr key={row.label}><td>{row.label}</td>{row.values.map((value, index) => <td key={index}>{value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>)}<td>{row.total.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td></tr>)}
                <tr className="report-history-total"><th>Total</th>{Array.from({ length: 5 }, (_, week) => <td key={week}>{metric.rows.reduce((sum, row) => sum + row.values[week], 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>)}<td>{metric.rows.reduce((sum, row) => sum + row.total, 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td></tr>
              </tbody>
            </table></div>
          </article>)}
        </section>
        <article className="panel data-table-panel">
          <div className="panel-heading"><div><h2>IDS por semana e dia</h2><p>Média das avaliações com IDS calculado em cada dia da semana.</p></div></div>
          <div className="table-scroll"><table><thead><tr><th>Dia</th>{Array.from({ length: 5 }, (_, index) => <th key={index}>S{index + 1}</th>)}<th>Média</th></tr></thead>
            <tbody>{weeklyIds.map(row => {
              const validValues = row.values.filter((value): value is number => value !== null)
              const average = validValues.length ? validValues.reduce((sum, value) => sum + value, 0) / validValues.length : null
              return <tr className={row.label === 'Média' ? 'report-history-total' : ''} key={row.label}><td>{row.label}</td>{row.values.map((value, index) => <td key={index}><IndicatorResult kind="ids" value={value} /></td>)}<td><IndicatorResult kind="ids" value={average} /></td></tr>
            })}</tbody>
          </table></div>
        </article>
        <section className="data-charts-grid">
          <article className="panel data-chart-panel"><div className="panel-heading"><div><h2>Desvios por severidade</h2><p>Contagens do período selecionado</p></div></div><div className="data-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={severityData} layout="vertical" margin={{ top: 8, right: 20, left: 15, bottom: 8 }}><CartesianGrid stroke="#e8ece7" strokeDasharray="3 5" horizontal={false} /><XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#858e87', fontSize: 10 }} /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={90} tick={{ fill: '#68766d', fontSize: 10 }} /><Tooltip formatter={(value) => [Number(value).toLocaleString('pt-BR'), 'Desvios']} /><Bar dataKey="total" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></article>
          <article className="panel data-chart-panel"><div className="panel-heading"><div><h2>Quantidade por categoria</h2><p>Somatório dos itens observados</p></div></div><div className="data-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={reportData.categories} layout="vertical" margin={{ top: 8, right: 20, left: 15, bottom: 8 }}><CartesianGrid stroke="#e8ece7" strokeDasharray="3 5" horizontal={false} /><XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#858e87', fontSize: 10 }} /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={132} tick={{ fill: '#68766d', fontSize: 9 }} /><Tooltip formatter={(value) => [Number(value).toLocaleString('pt-BR'), 'Quantidade']} /><Bar dataKey="quantity" fill="#3d7655" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></article>
        </section>
        <section className="data-tables-grid">
          <article className="panel data-table-panel"><div className="panel-heading"><div><h2>Consolidação diária</h2><p>Totais por data da avaliação</p></div></div><div className="table-scroll"><table><thead><tr><th>Data</th><th>Avaliações</th><th>Pessoas</th><th>Desvios</th><th>SD</th></tr></thead><tbody>{reportData.days.length === 0 ? <tr><td colSpan={5} className="data-empty-cell">Sem avaliações neste mês.</td></tr> : reportData.days.map((day) => <tr key={day.date}><td>{new Intl.DateTimeFormat('pt-BR').format(new Date(`${day.date}T12:00:00`))}</td><td>{day.evaluationCount}</td><td>{day.observedPeople.toLocaleString('pt-BR')}</td><td>{day.totalDeviations.toLocaleString('pt-BR')}</td><td>{day.weightedDeviationTotal.toLocaleString('pt-BR')}</td></tr>)}</tbody></table></div></article>
          <article className="panel data-table-panel"><div className="panel-heading"><div><h2>Itens por categoria</h2><p>Origem detalhada dos totais</p></div></div><div className="table-scroll"><table><thead><tr><th>Categoria</th><th>Item</th><th>Quantidade</th></tr></thead><tbody>{reportData.items.length === 0 ? <tr><td colSpan={3} className="data-empty-cell">Sem itens observados.</td></tr> : reportData.items.map((item) => <tr key={`${item.categoryCode}:${item.code}`}><td>{item.category}</td><td>{item.name}</td><td>{item.quantity.toLocaleString('pt-BR')}</td></tr>)}</tbody></table></div></article>
        </section>
        <section className="data-tables-grid" aria-label="Detalhamento semanal">
          <article className="panel data-table-panel"><div className="panel-heading"><div><h2>Desvios por severidade e semana</h2><p>Contagem de observações de segunda a sábado.</p></div></div>
            <div className="table-scroll"><table><thead><tr><th>Severidade</th>{Array.from({ length: 5 }, (_, index) => <th key={index}>S{index + 1}</th>)}<th>Total</th></tr></thead>
              <tbody>{weeklySeverityRows.map(row => <tr key={row.label}><td>{row.label}</td>{row.values.map((value, index) => <td key={index}>{value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>)}<td>{row.total.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td></tr>)}
                <tr className="report-history-total"><th>Total</th>{Array.from({ length: 5 }, (_, week) => <td key={week}>{weeklySeverityRows.reduce((sum, row) => sum + row.values[week], 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>)}<td>{weeklySeverityRows.reduce((sum, row) => sum + row.total, 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td></tr>
              </tbody>
            </table></div>
          </article>
          <article className="panel data-table-panel"><div className="panel-heading"><div><h2>Quantidade por categoria e semana</h2><p>Somatório dos itens observados por categoria.</p></div></div>
            <div className="table-scroll"><table><thead><tr><th>Categoria</th>{Array.from({ length: 5 }, (_, index) => <th key={index}>S{index + 1}</th>)}<th>Total</th></tr></thead>
              <tbody>{weeklyCategoryRows.length === 0
                ? <tr><td colSpan={7} className="data-empty-cell">Sem itens observados.</td></tr>
                : weeklyCategoryRows.map(row => <tr key={row.code}><td>{row.code}</td>{row.values.map((value, index) => <td key={index}>{value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>)}<td>{row.values.reduce((sum, value) => sum + value, 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td></tr>)}
                {weeklyCategoryRows.length > 0 && <tr className="report-history-total"><th>Total</th>{Array.from({ length: 5 }, (_, week) => <td key={week}>{weeklyCategoryRows.reduce((sum, row) => sum + row.values[week], 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>)}<td>{weeklyCategoryRows.reduce((sum, row) => sum + row.values.reduce((total, value) => total + value, 0), 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td></tr>}
              </tbody>
            </table></div>
          </article>
          <article className="panel data-table-panel data-week-detail"><div className="panel-heading"><div><h2>Itens por categoria e semana</h2><p>Quantidade detalhada por item, agrupada nas cinco semanas da planilha.</p></div></div>
            <div className="table-scroll"><table><thead><tr><th>Categoria</th><th>Item</th>{Array.from({ length: 5 }, (_, index) => <th key={index}>S{index + 1}</th>)}<th>Total</th></tr></thead>
              <tbody>{weeklyObservationRows.length === 0
                ? <tr><td colSpan={8} className="data-empty-cell">Sem itens observados.</td></tr>
                : weeklyObservationRows.map(row => <tr key={`${row.category}:${row.item}`}><td>{row.category}</td><td>{row.item}</td>{row.values.map((value, index) => <td key={index}>{value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>)}<td>{row.values.reduce((sum, value) => sum + value, 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td></tr>)}
                {weeklyObservationRows.length > 0 && <tr className="report-history-total"><th colSpan={2}>Total</th>{Array.from({ length: 5 }, (_, week) => <td key={week}>{weeklyObservationRows.reduce((sum, row) => sum + row.values[week], 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>)}<td>{weeklyObservationRows.reduce((sum, row) => sum + row.values.reduce((total, value) => total + value, 0), 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td></tr>}
              </tbody>
            </table></div>
          </article>
        </section>
      </>}
    </div>
  )
}

function Evaluations({ search, month, onCreate, onEdit, scopeQuery }: { search: string; month: string; onCreate: () => void; onEdit: (id: string) => void; scopeQuery: string }) {
  const [evaluations, setEvaluations] = useState<EvaluationSummary[]>([])
  const [catalog, setCatalog] = useState<ChecklistCatalog | null>(null)
  const [contractorId, setContractorId] = useState('')
  const [siteId, setSiteId] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'submitted'>('all')
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [catalogError, setCatalogError] = useState('')
  const [pendingSubmission, setPendingSubmission] = useState<EvaluationSummary | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [pdfError, setPdfError] = useState('')
  const [exportingEvaluationId, setExportingEvaluationId] = useState<string | null>(null)
  const query = search.trim()

  useEffect(() => {
    let isCurrent = true
    apiRequest<ChecklistCatalog>('/api/catalog')
      .then((result) => { if (isCurrent) setCatalog(result) })
      .catch((error: unknown) => { if (isCurrent) setCatalogError(error instanceof Error ? error.message : 'Não foi possível carregar os filtros.') })
      .finally(() => { if (isCurrent) setIsLoadingCatalog(false) })

    return () => { isCurrent = false }
  }, [])

  useEffect(() => {
    let isCurrent = true
    const start = `${month}-01`
    const endDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
    const end = `${month}-${String(endDay).padStart(2, '0')}`
    const parameters = new URLSearchParams({ from: start, to: end })
    if (contractorId) parameters.set('contractorId', contractorId)
    if (siteId) parameters.set('siteId', siteId)
    setIsLoading(true)
    setLoadError('')

    apiRequest<EvaluationSummary[]>(`/api/evaluations?${parameters}&${scopeQuery}`)
      .then((results) => { if (isCurrent) setEvaluations(results) })
      .catch((error: unknown) => { if (isCurrent) setLoadError(error instanceof Error ? error.message : 'Falha ao carregar avaliações.') })
      .finally(() => { if (isCurrent) setIsLoading(false) })

    return () => { isCurrent = false }
  }, [contractorId, month, siteId, scopeQuery])

  const searchedEvaluations = evaluations.filter((evaluation) => {
    if (!query) return true
    const searchable = [evaluation.site, evaluation.contractor, evaluation.leadAuditorName, evaluation.status].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR')
    return searchable.includes(query.toLocaleLowerCase('pt-BR'))
  })
  const draftCount = searchedEvaluations.filter((evaluation) => evaluation.status === 'Draft').length
  const submittedCount = searchedEvaluations.filter((evaluation) => evaluation.status === 'Submitted').length
  const filteredEvaluations = searchedEvaluations.filter((evaluation) =>
    statusFilter === 'all'
      || (statusFilter === 'draft' && evaluation.status === 'Draft')
      || (statusFilter === 'submitted' && evaluation.status === 'Submitted'))

  function exportEvaluations() {
    const columns: Array<[string, (evaluation: EvaluationSummary) => string | number | null]> = [
      ['Data', (evaluation) => new Intl.DateTimeFormat('pt-BR').format(new Date(`${evaluation.evaluationDate}T12:00:00`))],
      ['Local / projeto', (evaluation) => evaluation.site],
      ['Contratada', (evaluation) => evaluation.contractor],
      ['Avaliador', (evaluation) => evaluation.leadAuditorName],
      ['Pessoas observadas', (evaluation) => evaluation.indicators.observedPeople],
      ['Desvios registrados', (evaluation) => evaluation.indicators.totalDeviations],
      ['IDS (%)', (evaluation) => evaluation.indicators.ids === null ? null : evaluation.indicators.ids * 100],
      ['Estado', (evaluation) => evaluation.status === 'Draft' ? 'Rascunho' : 'Concluída'],
      ['Classificação IDS', (evaluation) => indicatorStatus('ids', evaluation.indicators.ids)],
    ]
    const csvCell = (value: string | number | null) => {
      const cell = value === null ? '' : String(value)
      const safeCell = typeof value === 'string' && /^[\s]*[=+\-@]/.test(cell) ? `'${cell}` : cell
      return `"${safeCell.replaceAll('"', '""')}"`
    }
    const csv = [
      columns.map(([heading]) => csvCell(heading)).join(';'),
      ...filteredEvaluations.map((evaluation) => columns.map(([heading, getValue]) => {
        const value = getValue(evaluation)
        return heading === 'IDS (%)' && typeof value === 'number' ? `"${value.toFixed(2)}"` : csvCell(value)
      }).join(';')),
    ].join('\r\n')
    const file = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
    const downloadUrl = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `ids-avaliacoes-${month}.csv`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
  }

  async function submitEvaluation() {
    if (!pendingSubmission) return
    setIsSubmitting(true)
    setSubmitError('')
    try {
      const submitted = await apiRequest<EvaluationSummary>(`/api/evaluations/${pendingSubmission.id}/submit`, { method: 'POST' })
      setEvaluations((current) => current.map((evaluation) => evaluation.id === submitted.id
        ? { ...evaluation, status: submitted.status }
        : evaluation))
      setPendingSubmission(null)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível enviar a avaliação.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function exportEvaluation(id: string) {
    setPdfError('')
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setPdfError('O navegador bloqueou a janela do PDF. Permita pop-ups para este site e tente novamente.')
      return
    }

    printWindow.document.body.textContent = 'Carregando avaliação para gerar o PDF…'
    setExportingEvaluationId(id)
    try {
      const evaluation = await apiRequest<EvaluationResult>(`/api/evaluations/${id}`)
      const pdf = evaluationPdf(evaluation)
      writePrintWindow(printWindow, pdf.title, pdf.content)
    } catch (error) {
      printWindow.close()
      setPdfError(error instanceof Error ? error.message : 'Não foi possível gerar o PDF da avaliação.')
    } finally {
      setExportingEvaluationId(null)
    }
  }

  return (
    <>
    <section className="panel list-panel">
      <div className="list-toolbar">
        <div className="segmented-control" role="group" aria-label="Estado das avaliações">
          <button aria-pressed={statusFilter === 'all'} className={statusFilter === 'all' ? 'selected' : ''} onClick={() => setStatusFilter('all')} type="button">Todas <span>{searchedEvaluations.length}</span></button>
          <button aria-pressed={statusFilter === 'draft'} className={statusFilter === 'draft' ? 'selected' : ''} onClick={() => setStatusFilter('draft')} type="button">Rascunhos <span>{draftCount}</span></button>
          <button aria-pressed={statusFilter === 'submitted'} className={statusFilter === 'submitted' ? 'selected' : ''} onClick={() => setStatusFilter('submitted')} type="button">Concluídas <span>{submittedCount}</span></button>
        </div>
        <div className="list-actions">
          <button aria-expanded={isFilterPanelOpen} className={`outline-button ${siteId || contractorId ? 'has-active-filters' : ''}`} onClick={() => setIsFilterPanelOpen((open) => !open)} type="button"><Filter size={15} /> Filtros{siteId || contractorId ? ' · ativos' : ''}</button>
          <button className="outline-button" disabled={isLoading || filteredEvaluations.length === 0} onClick={exportEvaluations} type="button"><Download size={15} /> Exportar CSV</button>
          <button className="primary-button" type="button" onClick={onCreate}><Plus size={15} /> Nova</button>
        </div>
      </div>
      {isFilterPanelOpen && <div className="evaluation-filters" aria-label="Filtros das avaliações">
        <label>Contratada<select disabled={isLoadingCatalog} onChange={(event) => setContractorId(event.target.value)} value={contractorId}><option value="">Todas as contratadas</option>{catalog?.organizations.filter((organization) => organization.kind === 'Contractor').map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
        <label>Local / projeto<select disabled={isLoadingCatalog} onChange={(event) => setSiteId(event.target.value)} value={siteId}><option value="">Todos os locais</option>{catalog?.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
        {(contractorId || siteId) && <button className="text-button clear-evaluation-filters" onClick={() => { setContractorId(''); setSiteId('') }} type="button">Limpar filtros</button>}
        {catalogError && <span className="evaluation-filter-error" role="alert">{catalogError}</span>}
      </div>}
      {loadError && <div className="form-error list-error" role="alert">{loadError}</div>}
      {submitError && <div className="form-error list-error" role="alert">{submitError}</div>}
      {pdfError && <div className="form-error list-error" role="alert">{pdfError}</div>}
      <div className="table-scroll"><table><thead><tr><th>Data</th><th>Local / projeto</th><th>Contratada</th><th>Avaliador</th><th>Pessoas</th><th>IDS</th><th>Estado</th><th aria-label="Ações" /></tr></thead><tbody>
        {isLoading ? <tr><td colSpan={8}><div className="table-empty evaluations-empty">Carregando avaliações…</div></td></tr> : filteredEvaluations.length === 0 ? <tr><td colSpan={8}><div className="table-empty evaluations-empty"><div className="empty-line-icon"><ClipboardCheck size={21} /></div><strong>{query ? `Nenhuma avaliação encontrada para “${query}”` : 'Nenhuma avaliação encontrada'}</strong><span>Ajuste os filtros ou registre a primeira avaliação.</span></div></td></tr> : filteredEvaluations.map((evaluation) => <tr className="evaluation-result-row" key={evaluation.id}><td>{new Intl.DateTimeFormat('pt-BR').format(new Date(`${evaluation.evaluationDate}T12:00:00`))}</td><td>{evaluation.site ?? '—'}</td><td>{evaluation.contractor ?? '—'}</td><td>{evaluation.leadAuditorName ?? '—'}</td><td>{evaluation.indicators.observedPeople ?? '—'}</td><td><IndicatorResult kind="ids" value={evaluation.indicators.ids} /></td><td><span className="draft-status">{evaluation.status === 'Draft' ? 'Rascunho' : 'Concluída'}</span></td><td><div className="row-actions"><button className="row-action" type="button" aria-label="Gerar PDF da avaliação" title="Gerar PDF da avaliação" disabled={exportingEvaluationId === evaluation.id} onClick={() => void exportEvaluation(evaluation.id)}><FileDown size={16} /></button>{evaluation.status === 'Draft' && <><button className="row-action" type="button" aria-label="Editar avaliação" title="Editar rascunho" onClick={() => onEdit(evaluation.id)}><Pencil size={15} /></button><button className="row-action submit-row-action" type="button" aria-label="Enviar avaliação" title="Enviar avaliação" onClick={() => { setSubmitError(''); setPendingSubmission(evaluation) }}><Send size={15} /></button></>}</div></td></tr>)}
      </tbody></table></div>
      <div className="list-footer"><span>{filteredEvaluations.length} de {evaluations.length} avaliações</span><span>{formatMonth(month)}</span></div>
    </section>
    {pendingSubmission && <div className="submit-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) setPendingSubmission(null) }}><section className="submit-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="submit-confirm-title"><span className="submit-confirm-icon"><Send size={18} /></span><h2 id="submit-confirm-title">Enviar avaliação?</h2><p>O rascunho de {new Intl.DateTimeFormat('pt-BR').format(new Date(`${pendingSubmission.evaluationDate}T12:00:00`))} será marcado como enviado. Depois disso, não poderá ser editado.</p><div className="submit-confirm-actions"><button className="outline-button" type="button" disabled={isSubmitting} onClick={() => setPendingSubmission(null)}>Cancelar</button><button className="primary-button" type="button" disabled={isSubmitting} onClick={() => void submitEvaluation()}><Send size={15} />{isSubmitting ? 'Enviando…' : 'Confirmar envio'}</button></div></section></div>}
    </>
  )
}

function monthRange(month: string) {
  const finalDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  return { from: `${month}-01`, to: `${month}-${String(finalDay).padStart(2, '0')}` }
}

function previousMonth(month: string) {
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function averageIds(items: EvaluationSummary[]) {
  const scored = items.filter(item => item.indicators.ids !== null)
  return scored.length ? scored.reduce((total, item) => total + (item.indicators.ids ?? 0), 0) / scored.length : null
}

function groupRanking(items: EvaluationSummary[], pick: (item: EvaluationSummary) => string | null) {
  const groups = new Map<string, EvaluationSummary[]>()
  items.forEach(item => {
    const key = pick(item) ?? 'Não informado'
    groups.set(key, [...(groups.get(key) ?? []), item])
  })
  return [...groups.entries()].map(([name, list]) => ({
    name,
    count: list.length,
    ids: averageIds(list),
    deviations: list.reduce((total, item) => total + item.indicators.totalDeviations, 0),
  })).sort((a, b) => (b.ids ?? -1) - (a.ids ?? -1))
}

function Delta({ current, previous, inverse = false, percentagePoints = false }: { current: number | null; previous: number | null; inverse?: boolean; percentagePoints?: boolean }) {
  if (current === null || previous === null) return <span className="indicator-delta neutral">Sem mês anterior para comparar</span>
  const difference = current - previous
  if (Math.abs(difference) < 0.0005 && percentagePoints) return <span className="indicator-delta neutral">Igual ao mês anterior</span>
  if (difference === 0) return <span className="indicator-delta neutral">Igual ao mês anterior</span>
  const good = inverse ? difference < 0 : difference > 0
  const formatted = percentagePoints
    ? `${difference > 0 ? '+' : ''}${formatIdsNumber(difference * 100)} p.p.`
    : `${difference > 0 ? '+' : ''}${difference.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`
  return <span className={`indicator-delta ${good ? 'good' : 'bad'}`}>{difference > 0 ? '▲' : '▼'} {formatted} vs. mês anterior</span>
}

function Indicators({ month, monthLabel, scopeQuery }: { month: string; monthLabel: string; scopeQuery: string }) {
  const [yearEvaluations, setYearEvaluations] = useState<EvaluationSummary[]>([])
  const [yearData, setYearData] = useState<DataConsolidation | null>(null)
  const [currentData, setCurrentData] = useState<DataConsolidation | null>(null)
  const [previousData, setPreviousData] = useState<DataConsolidation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const year = month.slice(0, 4)
  const monthNumber = Number(month.slice(5, 7))

  useEffect(() => {
    let isCurrent = true
    const yearRange = new URLSearchParams({ from: `${year}-01-01`, to: monthRange(month).to }).toString()
    const previous = previousMonth(month)
    Promise.all([
      apiRequest<EvaluationSummary[]>(`/api/evaluations?${yearRange}&${scopeQuery}`),
      apiRequest<DataConsolidation>(`/api/dashboard/data?${yearRange}&${scopeQuery}`),
      apiRequest<DataConsolidation>(`/api/dashboard/data?${new URLSearchParams(monthRange(month))}&${scopeQuery}`),
      apiRequest<DataConsolidation>(`/api/dashboard/data?${new URLSearchParams(monthRange(previous))}&${scopeQuery}`),
    ])
      .then(([evaluations, yearConsolidation, current, before]) => {
        if (!isCurrent) return
        setYearEvaluations(evaluations)
        setYearData(yearConsolidation)
        setCurrentData(current)
        setPreviousData(before)
        setError('')
      })
      .catch((loadError: unknown) => { if (isCurrent) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os indicadores.') })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [month, year, scopeQuery])

  const previous = previousMonth(month)
  const monthly = Array.from({ length: monthNumber }, (_, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`
    const items = yearEvaluations.filter(evaluation => evaluation.evaluationDate.startsWith(key))
    const days = yearData?.days.filter(day => day.date.startsWith(key)) ?? []
    return {
      key,
      label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(Date.UTC(Number(year), index, 15))),
      ids: averageIds(items),
      count: items.length,
      people: days.reduce((total, day) => total + day.observedPeople, 0),
      low: days.reduce((total, day) => total + day.lowSeverityDeviations, 0),
      medium: days.reduce((total, day) => total + day.mediumSeverityDeviations, 0),
      high: days.reduce((total, day) => total + day.highSeverityDeviations, 0),
    }
  })
  const current = monthly[monthNumber - 1]
  const before = monthly[monthNumber - 2] && monthly[monthNumber - 2].key === previous ? monthly[monthNumber - 2] : null
  const deviationsPerPerson = (data: DataConsolidation | null) => data && data.observedPeople > 0 ? data.totalDeviations / data.observedPeople : null
  const monthEvaluations = yearEvaluations.filter(evaluation => evaluation.evaluationDate.startsWith(month))
  const contractorRanking = groupRanking(monthEvaluations, evaluation => evaluation.contractor)
  const siteRanking = groupRanking(monthEvaluations, evaluation => evaluation.site)
  const scoredMonths = monthly.filter(item => item.ids !== null)
  const best = scoredMonths.length ? scoredMonths.reduce((a, b) => (b.ids ?? 0) > (a.ids ?? 0) ? b : a) : null
  const worst = scoredMonths.length ? scoredMonths.reduce((a, b) => (b.ids ?? 0) < (a.ids ?? 0) ? b : a) : null
  const ytdIds = averageIds(yearEvaluations)
  const draftCount = monthEvaluations.filter(evaluation => evaluation.status === 'Draft').length
  const itemMovement = (() => {
    const before = new Map((previousData?.items ?? []).map(item => [`${item.categoryCode}:${item.code}`, item.quantity]))
    return (currentData?.items ?? [])
      .map(item => ({ ...item, change: item.quantity - (before.get(`${item.categoryCode}:${item.code}`) ?? 0) }))
      .filter(item => item.quantity > 0 || item.change !== 0)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 8)
  })()
  const hasData = yearEvaluations.length > 0
  const monthLong = (key: string) => formatMonth(key)

  return <div className="indicator-layout">
    <div className="indicator-summary"><span className="summary-kicker"><BarChart3 size={16} /> ANÁLISE COMPARATIVA</span><h2>Indicadores de segurança</h2><p>Evolução de janeiro até {monthLabel}, comparação com o mês anterior e ranking de desempenho.</p></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {isLoading ? <div className="indicator-empty panel" role="status"><span>Carregando indicadores…</span></div>
      : !hasData ? <div className="indicator-empty panel"><div className="empty-line-icon"><Gauge size={22} /></div><strong>Aguardando avaliações</strong><span>Não há avaliações de janeiro até {monthLabel} para analisar.</span></div>
        : <>
          <section className="metric-grid" aria-label="Comparativo do mês">
            <article className="metric-card"><p className="metric-label">IDS do mês</p><strong className="metric-value"><IndicatorResult kind="ids" value={current?.ids} /></strong><Delta current={current?.ids ?? null} previous={before?.ids ?? null} percentagePoints /></article>
            <article className="metric-card"><p className="metric-label">IDS acumulado no ano</p><strong className="metric-value"><IndicatorResult kind="ids" value={ytdIds} /></strong><span className="metric-note">Janeiro a {monthLong(month)}</span></article>
            <article className="metric-card"><p className="metric-label">Desvios por pessoa observada</p><strong className="metric-value">{deviationsPerPerson(currentData)?.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) ?? '—'}</strong><Delta current={deviationsPerPerson(currentData)} previous={deviationsPerPerson(previousData)} inverse /></article>
            <article className="metric-card"><p className="metric-label">Avaliações no mês</p><strong className="metric-value">{current?.count ?? 0}</strong><Delta current={current?.count ?? 0} previous={before?.count ?? null} />{draftCount > 0 && <span className="metric-note">{draftCount} ainda em rascunho</span>}</article>
          </section>

          <section className="indicator-insights" aria-label="Destaques">
            <div><span>Melhor mês</span><strong>{best ? <>{monthLong(best.key)} · <IndicatorResult kind="ids" value={best.ids} /></> : '—'}</strong></div>
            <div><span>Mês de maior atenção</span><strong>{worst ? <>{monthLong(worst.key)} · <IndicatorResult kind="ids" value={worst.ids} /></> : '—'}</strong></div>
            <div><span>Desvios de severidade alta no mês</span><strong>{(current?.high ?? 0).toLocaleString('pt-BR')}</strong></div>
          </section>

          <section className="dashboard-charts-grid">
            <article className="panel dashboard-chart-panel">
              <div className="panel-heading"><div><h2>Evolução mensal do IDS</h2><p>Média das avaliações de cada mês.</p></div></div>
              <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthly} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                <defs><linearGradient id="idsMonthlyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2f7256" stopOpacity={0.22} /><stop offset="95%" stopColor="#2f7256" stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid stroke="#e8ece7" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#59675d', fontSize: 11 }} />
                <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#59675d', fontSize: 11 }} tickFormatter={(value: number) => formatIds(value)} />
                <Tooltip formatter={(value) => [<IndicatorResult key="ids" kind="ids" value={typeof value === 'number' ? value : null} />, 'IDS']} />
                <Area type="monotone" dataKey="ids" stroke="#2f7256" strokeWidth={2.5} fill="url(#idsMonthlyFill)" connectNulls />
              </AreaChart></ResponsiveContainer></div>
            </article>
            <article className="panel dashboard-chart-panel">
              <div className="panel-heading"><div><h2>Desvios por severidade, mês a mês</h2><p>Composição dos desvios em cada mês.</p></div></div>
              <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#e8ece7" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#59675d', fontSize: 11 }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#59675d', fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="low" name="Baixa" stackId="severity" fill="#77a989" />
                <Bar dataKey="medium" name="Média" stackId="severity" fill="#d29b54" />
                <Bar dataKey="high" name="Alta" stackId="severity" fill="#bf6963" radius={[4, 4, 0, 0]} />
              </BarChart></ResponsiveContainer></div>
              <div className="chart-footer"><span><i className="legend-dot" style={{ background: '#77a989' }} /> Baixa · <i className="legend-dot" style={{ background: '#d29b54' }} /> Média · <i className="legend-dot" style={{ background: '#bf6963' }} /> Alta</span></div>
            </article>
            <article className="panel dashboard-chart-panel">
              <div className="panel-heading"><div><h2>Esforço de observação</h2><p>Avaliações realizadas e pessoas observadas por mês.</p></div></div>
              <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#e8ece7" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#59675d', fontSize: 11 }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#59675d', fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Avaliações" fill="#3d7655" radius={[4, 4, 0, 0]} />
                <Bar dataKey="people" name="Pessoas observadas" fill="#4c7183" radius={[4, 4, 0, 0]} />
              </BarChart></ResponsiveContainer></div>
            </article>
          </section>

          <section className="dashboard-charts-grid">
            <RankingTable title="Ranking por contratada" subtitle={`IDS médio em ${monthLabel}`} rows={contractorRanking} />
            <RankingTable title="Ranking por local" subtitle={`IDS médio em ${monthLabel}`} rows={siteRanking} />
          </section>

          <article className="panel">
            <div className="panel-heading"><div><h2>Itens com maior variação</h2><p>Quantidade em {monthLabel} comparada ao mês anterior.</p></div></div>
            <div className="table-scroll"><table><thead><tr><th>Categoria</th><th>Item</th><th>Quantidade</th><th>Variação</th></tr></thead><tbody>
              {itemMovement.length === 0 ? <tr><td colSpan={4}><div className="table-empty">Nenhum item observado no período.</div></td></tr> : itemMovement.map(item => <tr key={`${item.categoryCode}-${item.code}`}><td>{item.category}</td><td>{item.name}</td><td>{item.quantity.toLocaleString('pt-BR')}</td><td><span className={`indicator-delta ${item.change > 0 ? 'bad' : item.change < 0 ? 'good' : 'neutral'}`}>{item.change > 0 ? '▲ +' : item.change < 0 ? '▼ ' : ''}{item.change.toLocaleString('pt-BR')}</span></td></tr>)}
            </tbody></table></div>
          </article>
        </>}
  </div>
}

function RankingTable({ title, subtitle, rows }: { title: string; subtitle: string; rows: Array<{ name: string; count: number; ids: number | null; deviations: number }> }) {
  return <article className="panel">
    <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div></div>
    <div className="table-scroll"><table><thead><tr><th>#</th><th>Nome</th><th>IDS</th><th>Aval.</th><th>Desvios</th></tr></thead><tbody>
      {rows.length === 0 ? <tr><td colSpan={5}><div className="table-empty">Sem avaliações no mês.</div></td></tr> : rows.map((row, index) => <tr key={row.name}>
        <td>{index + 1}</td><td>{row.name}</td>
        <td><div className="rank-bar"><div className="rank-bar-fill" style={{ width: `${Math.max(0, Math.min(100, (row.ids ?? 0) * 100))}%` }} /><span><IndicatorResult kind="ids" value={row.ids} /></span></div></td>
        <td>{row.count}</td><td>{row.deviations.toLocaleString('pt-BR')}</td>
      </tr>)}
    </tbody></table></div>
  </article>
}

function Reports({ month, monthLabel, scope }: { month: string; monthLabel: string; scope: InspectionScope }) {
  const scopeQuery = inspectionScopeQuery({ ...scope, islandId: undefined })
  const dataScopeQuery = inspectionScopeQuery(scope)
  const [reportTab, setReportTab] = useState<'monthly-data' | 'ipf-report'>('monthly-data')
  const [catalog, setCatalog] = useState<ChecklistCatalog | null>(null)
  const [contractorId, setContractorId] = useState('')
  const [siteId, setSiteId] = useState('')
  const [history, setHistory] = useState<IpfAnnualHistory | null>(null)
  const [suggestion, setSuggestion] = useState<IpfMonthlySuggestion | null>(null)
  const [yearSummary, setYearSummary] = useState<DashboardSummary | null>(null)
  const [generalYearSummary, setGeneralYearSummary] = useState<DashboardSummary | null>(null)
  const [monthlyData, setMonthlyData] = useState<DataConsolidation | null>(null)
  const [reportIssuedAt, setReportIssuedAt] = useState<Date | null>(null)
  const [multiplicationFactor, setMultiplicationFactor] = useState('0.8')
  const [additionalScore, setAdditionalScore] = useState('20')
  const [isFormulaDirty, setIsFormulaDirty] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [isReportDataLoading, setIsReportDataLoading] = useState(false)
  const [reportDataError, setReportDataError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveConfirmation, setSaveConfirmation] = useState('')
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(5, 7))

  useEffect(() => {
    apiRequest<ChecklistCatalog>('/api/catalog')
      .then(result => {
        setCatalog(result)
        setReportIssuedAt(new Date())
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as contratadas.'))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (!contractorId) {
      setHistory(null)
      setSuggestion(null)
      setYearSummary(null)
      setGeneralYearSummary(null)
      setMultiplicationFactor('0.8')
      setAdditionalScore('20')
      setIsFormulaDirty(false)
      setSiteId('')
      setIsHistoryLoading(false)
      return
    }

    let isCurrent = true
    setHistory(null)
    setSuggestion(null)
    setYearSummary(null)
    setGeneralYearSummary(null)
    setMultiplicationFactor('0.8')
    setAdditionalScore('20')
    setIsFormulaDirty(false)
    setSiteId('')
    setIsHistoryLoading(true)
    setError('')
    setSaveConfirmation('')
    const evaluationQuery = new URLSearchParams({
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      contractorId,
    })
    Promise.all([
      apiRequest<IpfAnnualHistory>(`/api/reports/ipf/${year}?contractorId=${contractorId}&${scopeQuery}`),
      apiRequest<IpfMonthlySuggestion>(`/api/reports/ipf/${year}/${monthNumber}/suggestion?contractorId=${contractorId}&${scopeQuery}`),
      apiRequest<DashboardSummary>(`/api/dashboard/summary?${evaluationQuery}&${scopeQuery}`),
      scope.islandId ? apiRequest<DashboardSummary>(`/api/dashboard/summary?${evaluationQuery}&${dataScopeQuery}`) : Promise.resolve(null),
    ])
      .then(([result, monthlySuggestion, summary, filteredSummary]) => {
        if (!isCurrent) return
        setHistory(result)
        setSuggestion(monthlySuggestion)
        setGeneralYearSummary(summary)
        setYearSummary(filteredSummary ?? summary)
        const currentValue = result.months.find(record => record.month === monthNumber)
        setMultiplicationFactor((currentValue?.multiplicationFactor ?? 0.8).toString())
        setAdditionalScore((currentValue?.additionalScore ?? 20).toString())
      })
      .catch((loadError: unknown) => { if (isCurrent) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o histórico IPF.') })
      .finally(() => { if (isCurrent) setIsHistoryLoading(false) })
    return () => { isCurrent = false }
  }, [contractorId, month, monthNumber, year, scopeQuery, dataScopeQuery, scope.islandId])

  useEffect(() => {
    let active = true
    setMonthlyData(null)
    setReportDataError('')
    if (!contractorId) {
      setIsReportDataLoading(false)
      return
    }
    const finalDay = new Date(year, monthNumber, 0).getDate()
    const query = new URLSearchParams({
      from: `${month}-01`,
      to: `${month}-${String(finalDay).padStart(2, '0')}`,
      contractorId,
    })
    if (siteId) query.set('siteId', siteId)
    setIsReportDataLoading(true)
    apiRequest<DataConsolidation>(`/api/dashboard/data?${query}&${dataScopeQuery}`)
      .then(data => { if (active) setMonthlyData(data) })
      .catch((loadError: unknown) => {
        if (active) setReportDataError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os gráficos do relatório.')
      })
      .finally(() => { if (active) setIsReportDataLoading(false) })
    return () => { active = false }
  }, [contractorId, siteId, month, year, monthNumber, dataScopeQuery])

  async function saveIpf() {
    if (!contractorId) {
      setError('Selecione uma contratada antes de salvar o IPF.')
      return
    }
    if (monthlyIdsAverage === null) {
      setError('Não há avaliações com IDS calculável neste mês e recorte para calcular o IPF.')
      return
    }
    if (calculatedIpf === null) {
      setError('Informe valores numéricos válidos para o fator multiplicador e a parcela adicional, dentro do limite de cálculo do IPF.')
      return
    }
    const value = calculatedIpf
    setIsSaving(true)
    setError('')
    setSaveConfirmation('')
    try {
      const savedRecord = await apiRequest<IpfAnnualHistory['months'][number]>(`/api/reports/ipf/${year}/${monthNumber}`, {
        method: 'PUT',
        body: JSON.stringify({
          contractorOrganizationId: contractorId, siteId: null, value,
          areaId: scope.areaId, formId: scope.formId,
          multiplicationFactor: Number(multiplicationFactor), additionalScore: Number(additionalScore),
        }),
      })
      setHistory((current) => {
        const months = [
          ...(current?.months ?? []).filter(record => record.month !== savedRecord.month),
          savedRecord,
        ].sort((left, right) => left.month - right.month)
        return {
          year: savedRecord.year,
          contractorOrganizationId: savedRecord.contractorOrganizationId,
          contractor: savedRecord.contractor,
          annualAverage: months.reduce((total, record) => total + record.value, 0) / months.length,
          months,
          areaId: scope.areaId,
          areaName: scope.areaName,
          formId: scope.formId,
          formName: scope.formName,
        }
      })
      setIsFormulaDirty(false)
      setSaveConfirmation('IPF salvo com sucesso.')
    } catch (saveError) {
      setError(saveError instanceof ApiError && saveError.status === 403
        ? 'Seu perfil não tem permissão para registrar IPF. Solicite acesso de ADMINISTRADOR ou GESTOR.'
        : saveError instanceof Error ? saveError.message : 'Não foi possível salvar o valor IPF.')
    } finally {
      setIsSaving(false)
    }
  }

  const periodMonths = history?.months.filter(record => record.month <= monthNumber) ?? []
  const periodAverage = periodMonths.length > 0 ? periodMonths.reduce((total, record) => total + record.value, 0) / periodMonths.length : null
  const yearTrend = (yearSummary?.trend ?? []).filter(point => !siteId || point.siteId === siteId)
  const averageTrendIds = (points: typeof yearTrend) => {
    const values = points.flatMap(point => point.ids === null ? [] : [point.ids])
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  }
  const distinctMetadata = (values: Array<string | null | undefined>) => {
    const uniqueValues = [...new Set(values.map(value => value?.trim()).filter((value): value is string => Boolean(value)))]
    return uniqueValues.length > 1 ? 'Múltiplos registros' : uniqueValues[0] ?? null
  }
  const reportMetadata = (field: 'projectOrIslands' | 'sites' | 'clients' | 'evaluators') => {
    const metadata = monthlyData?.metadata
    const values = siteId
      ? metadata?.bySite.filter(group => group.siteId === siteId).flatMap(group => group[field]) ?? []
      : metadata?.[field] ?? []
    return distinctMetadata(values)
  }
  const monthIds = Array.from({ length: 12 }, (_, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`
    return { month: index + 1, value: averageTrendIds(yearTrend.filter(point => point.date.startsWith(key))) }
  })
  const weekdayIds = reportWeekdays.map(({ index, label }) => {
    const values = Array.from({ length: 5 }, (_, week) => averageTrendIds(yearTrend.filter(point => {
      const date = new Date(`${point.date}T12:00:00`)
      return point.date.startsWith(month) && date.getDay() === index && reportWeekIndex(point.date) === week
    })))
    const populatedValues = values.filter((value): value is number => value !== null)
    return { label, values, average: populatedValues.length ? populatedValues.reduce((sum, value) => sum + value, 0) / populatedValues.length : null }
  })
  const weeklyIds = [
    ...weekdayIds,
    {
      label: 'Média',
      values: Array.from({ length: 5 }, (_, week) => {
        const values = weekdayIds.flatMap(row => {
          const value = row.values[week]
          return value === null ? [] : [value]
        })
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
      }),
      average: (() => {
        const values = weekdayIds.flatMap(row => row.values.filter((value): value is number => value !== null))
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
      })(),
    },
  ]
  const monthlyIdsAverage = averageTrendIds((generalYearSummary?.trend ?? []).filter(point => point.date.startsWith(month)))
  const calculatedIpf = calculateMonthlyIpf(monthlyIdsAverage, multiplicationFactor, additionalScore)
  const savedIpf = history?.months.find(record => record.month === monthNumber)?.value ?? null
  const legacyIpfMonths = history?.months.filter(record => record.siteId !== null).map(record => record.month) ?? []
  const enteredIpf = isFormulaDirty ? calculatedIpf : savedIpf ?? calculatedIpf
  const reportIpfMonths = Array.from({ length: 12 }, (_, index) => {
    const reportMonth = index + 1
    const savedValue = history?.months.find(record => record.month === reportMonth)?.value ?? null
    return { month: reportMonth, value: reportMonth === monthNumber && enteredIpf !== null ? enteredIpf : savedValue }
  })
  const idsAnnualAverage = (() => {
    const values = monthIds.flatMap(record => record.value === null ? [] : [record.value])
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  })()
  const ipfReportAverage = reportIpfMonths.some(record => record.value !== null)
    ? reportIpfMonths.reduce((sum, record) => sum + (record.value ?? 0), 0) / reportIpfMonths.filter(record => record.value !== null).length
    : null
  const reportPdf = history && monthlyData && reportIssuedAt ? monthlyIpfReportPdf({
      year,
      month: monthNumber,
      monthLabel,
      contractor: history.contractor,
      projectOrIsland: reportMetadata('projectOrIslands'),
      site: catalog?.sites.find(site => site.id === siteId)?.name ?? reportMetadata('sites'),
      client: reportMetadata('clients'),
      discipline: scope.areaName,
      legacyIpfMonths,
      evaluatedBy: reportMetadata('evaluators'),
      issuedAt: reportIssuedAt.toISOString(),
      ipfValue: enteredIpf,
      ipfAverage: ipfReportAverage,
      idsAverage: monthIds[monthNumber - 1]?.value ?? null,
      idsAnnualAverage,
      ipfMonths: reportIpfMonths,
      idsMonths: monthIds,
      weeklyIds,
      charts: buildWorkbookCharts({
        year,
        ipfMonths: reportIpfMonths,
        idsMonths: monthIds,
        ipfValue: enteredIpf,
        ipfAverage: ipfReportAverage,
        idsAnnualAverage,
        weeklyIds,
        data: monthlyData,
      }),
    }) : null
  function exportReportPdf() {
    if (!reportPdf) return
    setError('')
    if (!openPrintWindow(reportPdf.title, reportPdf.content)) {
      setError('O navegador bloqueou a janela do PDF. Permita pop-ups para este site e tente novamente.')
    }
  }

  return <section className="report-layout">
    {scope.islandId && <div className="form-error" role="status">A ilha filtra os dados de apoio. O IPF continua geral da contratada, em todos os projetos e ilhas.</div>}
    {legacyIpfMonths.length > 0 && <div className="form-error" role="status">O histórico contém IPFs antigos associados a projeto nos meses {legacyIpfMonths.join(', ')}. Eles são preservados até serem recalculados e salvos novamente como IPF geral da contratada.</div>}
    <div className="report-intro">
      <div>
        <span className="summary-kicker"><FileBarChart size={16} /> {reportTab === 'monthly-data' ? 'DADOS DO RELATÓRIO MENSAL' : 'RELATÓRIO IPF'}</span>
        <h2>{reportTab === 'monthly-data' ? 'Dados Relatório Mensal' : 'Relatório IPF'}</h2>
        <p>{reportTab === 'monthly-data'
          ? 'Consulte os dados da avaliação e registre o IPF para o mês de referência.'
          : 'Os 14 gráficos do modelo, na mesma ordem e com as cores e séries da planilha.'}</p>
      </div>
      {reportTab === 'ipf-report' && <button className="outline-button" disabled={!reportPdf || isHistoryLoading || isReportDataLoading} onClick={exportReportPdf} type="button"><FileDown size={16} /> Gerar PDF</button>}
    </div>
    <div className="workbook-tabs" role="tablist" aria-label="Abas do relatório mensal">
      <button id="monthly-data-tab" aria-controls="monthly-data-panel" type="button" role="tab" aria-selected={reportTab === 'monthly-data'} onClick={() => setReportTab('monthly-data')}>Dados Relatório Mensal</button>
      <button id="ipf-report-tab" aria-controls="ipf-report-panel" type="button" role="tab" aria-selected={reportTab === 'ipf-report'} onClick={() => setReportTab('ipf-report')}>Relatório IPF</button>
    </div>
    <form className="report-entry-card" onSubmit={(event) => { event.preventDefault(); void saveIpf() }}>
      <div className="report-entry-heading">
        <div>
          <span className="report-step">LANÇAMENTO DO MÊS</span>
          <h3>Dados Relatório Mensal</h3>
          <p>O IPF usa a média do IDS em percentual. Preencha o fator multiplicador e a parcela adicional; o resultado é calculado automaticamente.</p>
        </div>
        <span className="report-month-badge"><CalendarDays size={15} />{monthLabel}</span>
      </div>
      <div className="report-controls">
        <label>
          Contratada
          <select disabled={isLoading || isSaving} onChange={(event) => { setContractorId(event.target.value); setSaveConfirmation(''); setError('') }} value={contractorId}>
            <option value="">Selecionar contratada</option>
            {catalog?.organizations.filter(organization => organization.kind === 'Contractor').map(organization => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </select>
          <small>Escolha para consultar o histórico anual.</small>
        </label>
        <label>
          Local / site <span className="report-optional">(opcional)</span>
          <select disabled={!contractorId || isHistoryLoading || isSaving} onChange={(event) => { setSiteId(event.target.value); setSaveConfirmation(''); setError('') }} value={siteId}>
            <option value="">Sem local específico</option>
            {catalog?.sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
          <small>Filtra os gráficos e dados de apoio, sem alterar o cálculo do IPF.</small>
        </label>
      </div>
      <div className="report-controls report-formula-controls">
        <label>
          Média do IDS (%)
          <input
            readOnly
            type="text"
            value={monthlyIdsAverage === null ? '' : formatIdsNumber(monthlyIdsAverage * 100)}
          />
          {indicatorStatus('ids', monthlyIdsAverage) && <IndicatorResult kind="ids" value={monthlyIdsAverage} />}
          <small>Média das avaliações válidas da contratada no mês, em todos os projetos e ilhas.</small>
        </label>
        <label>
          Fator multiplicador
          <input
            disabled={!contractorId || isHistoryLoading || isSaving}
            inputMode="decimal"
            onChange={(event) => { setMultiplicationFactor(event.target.value); setIsFormulaDirty(true); setSaveConfirmation(''); setError('') }}
            step="any"
            type="number"
            required
            value={multiplicationFactor}
          />
          <small>Campo correspondente ao 0,8 do exemplo.</small>
        </label>
        <label>
          Parcela adicional
          <input
            disabled={!contractorId || isHistoryLoading || isSaving}
            inputMode="decimal"
            onChange={(event) => { setAdditionalScore(event.target.value); setIsFormulaDirty(true); setSaveConfirmation(''); setError('') }}
            step="any"
            type="number"
            required
            value={additionalScore}
          />
          <small>Campo correspondente ao +20 do exemplo.</small>
        </label>
        <label>
          Valor do IPF
          <input aria-describedby="report-ipf-help" readOnly type="text" value={formatIpf(enteredIpf, '')} />
          {indicatorStatus('ipf', enteredIpf) && <IndicatorResult kind="ipf" value={enteredIpf} />}
          <small id="report-ipf-help">((Média do IDS (%) × 60 × fator) / 100 + parcela adicional) / 10. A classificação usa o valor completo, antes do arredondamento.</small>
          {savedIpf !== null && !isFormulaDirty && <small>IPF salvo preservado. Altere os campos ou salve para recalcular com a média atual.</small>}
          {suggestion && <small className="report-suggestion-note">
            {monthlyIdsAverage !== null
              ? 'O cálculo usa a média completa, sem arredondamento intermediário. O resultado é salvo com quatro casas decimais.'
              : suggestion.evaluationCount > 0
                ? 'Não há IDS calculável no recorte selecionado.'
                : 'Este mês ainda não tem avaliações. Não é possível calcular o IPF.'}
          </small>}
        </label>
        <button className="primary-button report-save-button" disabled={!contractorId || isLoading || isHistoryLoading || isSaving || calculatedIpf === null} type="submit">
          {isSaving ? 'Salvando…' : 'Salvar IPF'}
        </button>
      </div>
      <div className="report-access-note"><ShieldCheck size={15} /><span>O registro é permitido para os perfis Administrador e Gestor.</span></div>
    </form>
    {error && <div className="form-error report-feedback" role="alert">{error}</div>}
    {reportDataError && <div className="form-error report-feedback" role="alert">{reportDataError}</div>}
    {saveConfirmation && <div className="report-save-confirmation report-feedback" role="status"><Check size={16} />{saveConfirmation}</div>}
    {!contractorId
      ? <div className="report-empty panel"><div className="empty-line-icon"><FileBarChart size={21} /></div><strong>Selecione uma contratada</strong><span>O histórico mensal e os indicadores aparecerão aqui.</span></div>
      : isHistoryLoading || isReportDataLoading
        ? <div className="report-empty panel" role="status"><span>Carregando histórico de {year}…</span></div>
        : history && <>
          <div className="report-summary-strip">
            <div><span>Contratada</span><strong>{history.contractor}</strong></div>
            <div><span>Período</span><strong>Janeiro a {monthLabel}</strong></div>
            <div><span>Média do período</span><strong><IndicatorResult kind="ipf" value={periodAverage} /></strong></div>
            <div><span>Meses registrados</span><strong>{periodMonths.length} de {monthNumber}</strong></div>
          </div>
          {reportTab === 'monthly-data' && <article id="monthly-data-panel" role="tabpanel" aria-labelledby="monthly-data-tab" className="panel report-data-sheet">
            <div className="panel-heading"><div><h2>Dados Relatório Mensal</h2><p>Identificação preenchida a partir das avaliações e do escopo selecionado.</p></div></div>
            <dl className="report-data-fields">
              <div><dt>Nome do projeto e ilha</dt><dd>{reportMetadata('projectOrIslands') ?? '—'}</dd></div>
              <div><dt>Local do site</dt><dd>{catalog?.sites.find(site => site.id === siteId)?.name ?? reportMetadata('sites') ?? '—'}</dd></div>
              <div><dt>Cliente</dt><dd>{reportMetadata('clients') ?? '—'}</dd></div>
              <div><dt>Contratada</dt><dd>{history.contractor}</dd></div>
              <div><dt>Disciplina</dt><dd>{scope.areaName}</dd></div>
              <div><dt>Mês e ano da avaliação</dt><dd>{monthLabel}</dd></div>
              <div><dt>Avaliado por</dt><dd>{reportMetadata('evaluators') ?? '—'}</dd></div>
              <div><dt>Data de emissão</dt><dd>{reportIssuedAt ? new Intl.DateTimeFormat('pt-BR').format(reportIssuedAt) : '—'}</dd></div>
              <div><dt>Horário de emissão</dt><dd>{reportIssuedAt ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(reportIssuedAt) : '—'}</dd></div>
            </dl>
            <div className="report-history-grid">
              <h3 className="monthly-results-band">Resultados</h3>
              <div className="table-scroll"><table><thead><tr><th colSpan={2}>Resultados de IPF Anteriores</th></tr><tr><th>Mês</th><th>Média</th></tr></thead><tbody>
                {reportIpfMonths.map(record => <tr key={record.month}><td>{new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(Date.UTC(year, record.month - 1, 15)))}</td><td><IndicatorResult kind="ipf" value={record.value} /></td></tr>)}
                <tr className="report-history-total"><th>Resultado do Mês de Referência</th><td><IndicatorResult kind="ipf" value={enteredIpf} /></td></tr>
                <tr className="report-history-total"><th>Média Anual</th><td><IndicatorResult kind="ipf" value={ipfReportAverage} /></td></tr>
              </tbody></table></div>
              <div className="table-scroll"><table><thead><tr><th colSpan={2}>Resultados de IDS</th></tr><tr><th>Mês</th><th>Média</th></tr></thead><tbody>
                {monthIds.map(record => <tr key={record.month}><td>{new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(Date.UTC(year, record.month - 1, 15)))}</td><td><IndicatorResult kind="ids" value={record.value} /></td></tr>)}
                <tr className="report-history-total"><th>Resultado do Mês de Referência</th><td><IndicatorResult kind="ids" value={monthIds[monthNumber - 1]?.value} /></td></tr>
                <tr className="report-history-total"><th>Média Anual</th><td><IndicatorResult kind="ids" value={idsAnnualAverage} /></td></tr>
              </tbody></table></div>
            </div>
          </article>}
          {reportTab === 'ipf-report' && reportPdf && <div id="ipf-report-panel" role="tabpanel" aria-labelledby="ipf-report-tab" dangerouslySetInnerHTML={{ __html: reportPdf.content }} />}
        </>}
  </section>
}

function SettingsView() {
  const [branding, setBranding] = useState<ReportBranding>(loadBranding)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const logoInput = useRef<HTMLInputElement>(null)

  async function chooseLogo(file: File | undefined) {
    if (!file) return
    setError('')
    setMessage('')
    try {
      const logoDataUrl = await readLogoFile(file)
      setBranding(current => ({ ...current, logoDataUrl }))
    } catch (logoError) {
      setError(logoError instanceof Error ? logoError.message : 'Não foi possível carregar o logo.')
    }
  }

  async function save() {
    try {
      const saved = await saveBranding({ ...branding, companyName: branding.companyName.trim(), tagline: branding.tagline.trim() })
      setBranding(saved)
      setError('')
      setMessage('Identidade dos relatórios salva para os usuários da sua empresa. Os próximos PDFs já usam estas informações.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar.')
    }
  }

  const palette = ['#173e2e', '#1f4e79', '#7a1f2b', '#4a3a7a', '#8a5a00', '#2f3a45']

  return <div className="settings-grid">
    <section className="panel branding-card">
      <div className="panel-heading"><div><h2>Identidade dos relatórios (PDF)</h2><p>Logo, nome e cores usados nos relatórios da sua empresa. Não alteram os relatórios de outras empresas.</p></div></div>
      <div className="branding-form">
        <label>Nome da empresa
          <input maxLength={80} onChange={(event) => { setBranding({ ...branding, companyName: event.target.value }); setMessage('') }} placeholder="Ex.: Segurança & Cia Ltda." value={branding.companyName} />
        </label>
        <label>Slogan ou descrição <span className="report-optional">(opcional)</span>
          <input maxLength={100} onChange={(event) => { setBranding({ ...branding, tagline: event.target.value }); setMessage('') }} placeholder="Ex.: Consultoria em segurança do trabalho" value={branding.tagline} />
        </label>
        <div className="palette-row" role="group" aria-label="Paleta de cores do PDF">
          <span>Cor do PDF</span>
          {palette.map(color => (
            <button aria-label={`Cor ${color}`} aria-pressed={branding.primaryColor.toLowerCase() === color} className="palette-swatch" key={color} onClick={() => { setBranding({ ...branding, primaryColor: color }); setMessage('') }} style={{ background: color }} type="button" />
          ))}
          <input aria-label="Cor personalizada" className="palette-custom" onChange={(event) => { setBranding({ ...branding, primaryColor: event.target.value }); setMessage('') }} type="color" value={branding.primaryColor || defaultPrimaryColor} />
        </div>
        <div className="branding-logo-row">
          <button className="outline-button branding-upload" type="button" onClick={() => logoInput.current?.click()}>Escolher logo</button>
          <input accept="image/png,image/jpeg,image/svg+xml,image/*" className="branding-file-input" onChange={(event) => { void chooseLogo(event.target.files?.[0]); event.target.value = '' }} ref={logoInput} tabIndex={-1} type="file" />
          {branding.logoDataUrl && <button className="text-button" type="button" onClick={() => { setBranding({ ...branding, logoDataUrl: '' }); setMessage('') }}>Remover logo</button>}
          <small>PNG, JPG ou SVG. A imagem é reduzida automaticamente.</small>
        </div>
      </div>
      <div className="branding-preview" aria-label="Prévia do cabeçalho" style={{ borderColor: branding.primaryColor }}>
        <div className="branding-preview-head">
          <div className="branding-preview-issuer">
            {branding.logoDataUrl && <img alt="" src={branding.logoDataUrl} />}
            <div><strong style={{ color: branding.primaryColor }}>{branding.companyName || 'IDS'}</strong><span>{branding.companyName ? branding.tagline : 'Gestão de segurança operacional'}</span></div>
          </div>
          <div className="branding-preview-title"><strong style={{ color: branding.primaryColor }}>Avaliação de segurança</strong><span>Registro individual</span></div>
        </div>
        <div className="branding-preview-contractor" style={{ borderTopColor: branding.primaryColor, color: branding.primaryColor }}><span>CONTRATADA</span><strong>Nome da contratada avaliada</strong></div>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="report-save-confirmation" role="status"><Check size={16} />{message}</div>}
      <div><button className="primary-button" onClick={() => void save()} type="button">Salvar identidade</button></div>
    </section>
  </div>
}

function AccountPassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (newPassword !== confirmPassword) {
      setError('A confirmação deve ser igual à nova senha.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiRequest('/api/auth/me/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Senha alterada. Use a nova senha no próximo acesso.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível alterar a senha.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return <section className="panel users-card">
    <div className="panel-heading"><div><h2>Alterar minha senha</h2><p>Informe sua senha atual e escolha uma nova senha com pelo menos 8 caracteres. Não é necessário usar a chave do Render.</p></div></div>
    <form className="users-form" onSubmit={(event) => void changePassword(event)}>
      <label>Senha atual<input autoComplete="current-password" disabled={isSubmitting} onChange={(event) => setCurrentPassword(event.target.value)} required type="password" value={currentPassword} /></label>
      <label>Nova senha<input autoComplete="new-password" disabled={isSubmitting} minLength={8} onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} /></label>
      <label>Confirmar nova senha<input autoComplete="new-password" disabled={isSubmitting} minLength={8} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} /></label>
      <button className="primary-button" disabled={isSubmitting} type="submit">{isSubmitting ? 'Salvando…' : 'Alterar senha'}</button>
    </form>
    {error && <div className="form-error" role="alert">{error}</div>}
    {message && <div className="report-save-confirmation" role="status"><Check size={16} />{message}</div>}
  </section>
}

interface ManagedUser { id: string; email: string; displayName: string; role: string; blocked: boolean }

function UsersAdmin() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [form, setForm] = useState({ displayName: '', email: '', password: '', role: 'AVALIADOR' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    apiRequest<ManagedUser[]>('/api/auth/users').then(list => { if (active) setUsers(list) }).catch(() => { if (active) setError('Não foi possível carregar os usuários.') })
    return () => { active = false }
  }, [refresh])

  async function run(action: () => Promise<unknown>, success: string) {
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(success)
      setRefresh(value => value + 1)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Operação não concluída.')
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    await run(async () => {
      await apiRequest('/api/auth/users', { method: 'POST', body: JSON.stringify(form) })
      setForm({ displayName: '', email: '', password: '', role: 'AVALIADOR' })
    }, 'Usuário criado.')
  }

  function resetPassword(user: ManagedUser) {
    const password = window.prompt(`Nova senha para ${user.displayName} (mínimo 8 caracteres):`)
    if (password) void run(() => apiRequest(`/api/auth/users/${user.id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }), 'Senha redefinida.')
  }

  return <section className="panel users-card">
    <div className="panel-heading"><div><h2>Usuários e perfis</h2><p>Administradores veem todas as avaliações da própria empresa. Usuários comuns veem e editam somente as próprias. As contas criadas aqui pertencem à sua empresa.</p></div></div>
    <form className="users-form" onSubmit={(event) => void create(event)}>
      <label>Nome<input onChange={(event) => setForm({ ...form, displayName: event.target.value })} required value={form.displayName} /></label>
      <label>E-mail<input onChange={(event) => setForm({ ...form, email: event.target.value })} required type="email" value={form.email} /></label>
      <label>Senha inicial<input autoComplete="new-password" minLength={8} onChange={(event) => setForm({ ...form, password: event.target.value })} required type="password" value={form.password} /></label>
      <label>Perfil
        <select onChange={(event) => setForm({ ...form, role: event.target.value })} value={form.role}>
          <option value="AVALIADOR">Usuário comum</option>
          <option value="ADMINISTRADOR">Administrador</option>
        </select>
      </label>
      <button className="primary-button" type="submit">Criar usuário</button>
    </form>
    {error && <div className="form-error" role="alert">{error}</div>}
    {message && <div className="report-save-confirmation" role="status"><Check size={16} />{message}</div>}
    <div className="users-list">
      {users.map(user => <div className="users-row" key={user.id}>
        <div><strong>{user.displayName}</strong><small>{user.email} · {user.role === 'ADMINISTRADOR' ? 'Administrador' : user.role === 'AVALIADOR' ? 'Usuário comum' : user.role}{user.blocked ? ' · Bloqueado' : ''}</small></div>
        <div className="users-actions">
          <button className="text-button" type="button" onClick={() => resetPassword(user)}>Redefinir senha</button>
          <button className="text-button" type="button" onClick={() => void run(() => apiRequest(`/api/auth/users/${user.id}/active`, { method: 'PUT', body: JSON.stringify({ active: user.blocked }) }), user.blocked ? 'Usuário liberado.' : 'Usuário bloqueado.')}>{user.blocked ? 'Liberar' : 'Bloquear'}</button>
        </div>
      </div>)}
    </div>
  </section>
}

export default App
