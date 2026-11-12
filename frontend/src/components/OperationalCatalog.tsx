import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest, type ChecklistCatalog, type InspectionArea } from '../lib/api'

type Site = ChecklistCatalog['sites'][number]
type Organization = ChecklistCatalog['organizations'][number]

interface CreateCardProps {
  title: string
  label: string
  placeholder: string
  maxLength: number
  secondaryLabel?: string
  entries: string[]
  onCreate: (name: string, secondary: string) => Promise<void>
  note?: string
}

function CreateCard({ title, label, placeholder, maxLength, secondaryLabel, entries, onCreate, note }: CreateCardProps) {
  const [name, setName] = useState('')
  const [secondary, setSecondary] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    setError('')
    setMessage('')
    if (!trimmed) {
      setError('Informe um nome.')
      return
    }
    setSaving(true)
    try {
      await onCreate(trimmed, secondary.trim())
      setName('')
      setSecondary('')
      setMessage(`"${trimmed}" cadastrado com sucesso.`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Não foi possível salvar o cadastro.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="panel users-card operational-catalog-card">
    <div className="panel-heading"><div><h2>{title}</h2>{note && <p>{note}</p>}</div></div>
    <form className="form-fields" onSubmit={event => void submit(event)}>
      <label>{label}<input required maxLength={maxLength} value={name} onChange={event => setName(event.target.value)} placeholder={placeholder} disabled={saving} /></label>
      {secondaryLabel && <label>{secondaryLabel}<input maxLength={200} value={secondary} onChange={event => setSecondary(event.target.value)} disabled={saving} /></label>}
      <div><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Cadastrar'}</button></div>
    </form>
    {error && <div className="form-error" role="alert">{error}</div>}
    {message && <div className="report-save-confirmation" role="status">{message}</div>}
    <div className="operational-catalog-list"><strong>Já cadastrados</strong>
      {entries.length ? <ul>{entries.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}</ul> : <p>Nenhum cadastro encontrado.</p>}
    </div>
  </section>
}

export function OperationalCatalog({ canCreateArea }: { canCreateArea: boolean }) {
  const [catalog, setCatalog] = useState<ChecklistCatalog | null>(null)
  const [areas, setAreas] = useState<InspectionArea[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest<ChecklistCatalog>('/api/catalog'),
      apiRequest<InspectionArea[]>('/api/inspection-areas'),
    ]).then(([loadedCatalog, loadedAreas]) => {
      if (active) { setCatalog(loadedCatalog); setAreas(loadedAreas) }
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os cadastros.')
    })
    return () => { active = false }
  }, [])

  if (error) return <div className="form-error" role="alert">{error}</div>
  if (!catalog || !areas) return <div className="form-loading" role="status">Carregando cadastros…</div>

  return <div className="operational-catalog-grid">
    <CreateCard title="Empresas contratadas" label="Nome da contratada" placeholder="Ex.: Empresa contratada" maxLength={200}
      entries={catalog.organizations.filter(org => org.kind === 'Contractor').map(org => org.name)}
      onCreate={async name => {
        const created = await apiRequest<Organization>('/api/catalog/organizations', { method: 'POST', body: JSON.stringify({ name, kind: 'Contractor' }) })
        setCatalog(current => current ? { ...current, organizations: [...current.organizations, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) } : current)
      }} />
    <CreateCard title="Locais e projetos" label="Nome do local" placeholder="Ex.: Unidade ou obra" maxLength={200} secondaryLabel="Projeto / ilha (opcional)"
      entries={catalog.sites.map(site => site.projectOrIsland ? `${site.name} · ${site.projectOrIsland}` : site.name)}
      onCreate={async (name, secondary) => {
        const created = await apiRequest<Site>('/api/catalog/sites', { method: 'POST', body: JSON.stringify({ name, projectOrIsland: secondary || null }) })
        setCatalog(current => current ? { ...current, sites: [...current.sites, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) } : current)
      }} />
    {canCreateArea ? <CreateCard title="Áreas de inspeção" label="Nome da área" placeholder="Ex.: Meio Ambiente ou Qualidade" maxLength={150}
      note="Depois de cadastrar a área, crie ou duplique um formulário de inspeção para utilizá-la."
      entries={areas.map(area => area.name)}
      onCreate={async name => {
        const created = await apiRequest<InspectionArea>('/api/inspection-areas', { method: 'POST', body: JSON.stringify({ name }) })
        setAreas(current => current ? [...current, created] : current)
      }} /> : <section className="panel users-card operational-catalog-card">
      <div className="panel-heading"><div><h2>Áreas de inspeção</h2><p>Somente administradores podem cadastrar áreas.</p></div></div>
      <div className="operational-catalog-list"><strong>Já cadastrados</strong><ul>{areas.map(area => <li key={area.id}>{area.name}</li>)}</ul></div>
    </section>}
  </div>
}
