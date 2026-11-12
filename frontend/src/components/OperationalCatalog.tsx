import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest, type ChecklistCatalog, type InspectionArea, type InspectionIsland } from '../lib/api'

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

function IslandsCard({ islands, onChanged }: { islands: InspectionIsland[]; onChanged: (island: InspectionIsland) => void }) {
    const [name, setName] = useState('')
    const [editing, setEditing] = useState('')
    const [editName, setEditName] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    async function save(event: FormEvent<HTMLFormElement>) {
      event.preventDefault()
      const trimmed = name.trim()
      if (!trimmed) { setError('Informe o nome da ilha.'); return }
      setBusy(true); setError(''); setMessage('')
      try {
        const created = await apiRequest<InspectionIsland>('/api/inspection-islands', { method: 'POST', body: JSON.stringify({ name: trimmed }) })
        onChanged(created); setName(''); setMessage(`Ilha "${created.name}" cadastrada.`)
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Não foi possível cadastrar a ilha.')
      } finally { setBusy(false) }
    }

    async function update(island: InspectionIsland, active?: boolean) {
      const trimmed = editName.trim()
      if (active === undefined && !trimmed) { setError('Informe o nome da ilha.'); return }
      if (active !== undefined && !window.confirm(`${active ? 'Reativar' : 'Desativar'} a ilha "${island.name}"? O histórico será mantido.`)) return
      setBusy(true); setError(''); setMessage('')
      try {
        const updated = await apiRequest<InspectionIsland>(`/api/inspection-islands/${island.id}${active === undefined ? '' : '/active'}`, {
          method: 'PUT', body: JSON.stringify(active === undefined ? { name: trimmed } : { isActive: active }),
        })
        onChanged(updated); setEditing(''); setMessage(`Ilha "${updated.name}" atualizada.`)
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Não foi possível atualizar a ilha.')
      } finally { setBusy(false) }
    }

    return <section className="panel users-card operational-catalog-card">
      <div className="panel-heading"><div><h2>Locais / ilhas</h2></div></div>
      <form className="form-fields" onSubmit={event => void save(event)}>
        <label>Nome da ilha<input required maxLength={200} value={name} onChange={event => setName(event.target.value)} disabled={busy} placeholder="Ex.: Ilha A" /></label>
        <div><button className="primary-button" type="submit" disabled={busy}>Cadastrar</button></div>
      </form>
      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="report-save-confirmation" role="status">{message}</div>}
      <div className="operational-catalog-list"><strong>Já cadastrados</strong>
        {islands.length === 0 ? <p>Nenhuma ilha cadastrada.</p> : <div className="users-list">{islands.map(island => <div className="users-row" key={island.id}>
          {editing === island.id ? <div className="form-fields"><label>Editar ilha<input maxLength={200} value={editName} disabled={busy} onChange={event => setEditName(event.target.value)} /></label>
            <div className="users-actions"><button className="outline-button" type="button" disabled={busy} onClick={() => void update(island)}>Salvar</button><button className="outline-button" type="button" disabled={busy} onClick={() => setEditing('')}>Cancelar</button></div></div>
            : <><div><strong>{island.name}</strong><small>{island.isActive ? 'Ativa' : 'Desativada'}</small></div>
              <div className="users-actions"><button className="outline-button" type="button" disabled={busy} onClick={() => { setEditing(island.id); setEditName(island.name); setError(''); setMessage('') }}>Editar</button>
                <button className="outline-button" type="button" disabled={busy} onClick={() => void update(island, !island.isActive)}>{island.isActive ? 'Desativar' : 'Reativar'}</button></div></>}
        </div>)}</div>}
      </div>
    </section>
  }

function ManageCatalog<T extends { id: string; name: string; isActive: boolean }>({ title, entries, endpoint, onChanged, protectDefault = false }: {
  title: string
  entries: T[]
  endpoint: string
  onChanged: (item: T) => void
  protectDefault?: boolean
}) {
  const [editing, setEditing] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function update(item: T, isActive?: boolean) {
    const trimmed = name.trim()
    if (isActive === undefined && !trimmed) { setError('Informe um nome.'); return }
    if (isActive !== undefined && !window.confirm(`${isActive ? 'Reativar' : 'Desativar'} "${item.name}"? O histórico será mantido.`)) return
    setBusy(true); setError(''); setMessage('')
    try {
      const saved = await apiRequest<T>(`${endpoint}/${item.id}${isActive === undefined ? '' : '/active'}`, {
        method: 'PUT', body: JSON.stringify(isActive === undefined ? { name: trimmed } : { isActive }),
      })
      onChanged(saved); setEditing(''); setMessage(`"${saved.name}" atualizado.`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível atualizar o cadastro.')
    } finally { setBusy(false) }
  }

  return <section className="panel users-card operational-catalog-card"><div className="panel-heading"><div><h2>{title}</h2></div></div>
    {error && <div role="alert" className="form-error">{error}</div>}
    {message && <div role="status" className="report-save-confirmation">{message}</div>}
    {!entries.length ? <p>Nenhum cadastro encontrado.</p> : <div className="users-list">{entries.map(item => <div className="users-row" key={item.id}>
      {editing === item.id ? <div className="form-fields"><label>Nome<input value={name} maxLength={protectDefault ? 150 : 200} disabled={busy} onChange={event => setName(event.target.value)} /></label>
        <div className="users-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => void update(item)}>Salvar</button><button type="button" className="outline-button" disabled={busy} onClick={() => setEditing('')}>Cancelar</button></div></div>
        : <><div><strong>{item.name}</strong><small>{item.isActive ? 'Ativo' : 'Desativado'}</small></div><div className="users-actions">
          <button type="button" className="outline-button" disabled={busy} onClick={() => { setEditing(item.id); setName(item.name); setError(''); setMessage('') }}>Editar</button>
          {!(protectDefault && item.id === '00000000-0000-0000-0000-000000000000') && <button type="button" className="outline-button" disabled={busy} onClick={() => void update(item, !item.isActive)}>{item.isActive ? 'Desativar' : 'Reativar'}</button>}
        </div></>}
    </div>)}</div>}
  </section>
}

export function OperationalCatalog({ canCreateArea }: { canCreateArea: boolean }) {
  const [catalog, setCatalog] = useState<ChecklistCatalog | null>(null)
  const [areas, setAreas] = useState<InspectionArea[] | null>(null)
  const [islands, setIslands] = useState<InspectionIsland[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest<ChecklistCatalog>('/api/catalog'),
      apiRequest<InspectionArea[]>('/api/inspection-areas'),
      apiRequest<InspectionIsland[]>('/api/inspection-islands'),
    ]).then(([loadedCatalog, loadedAreas, loadedIslands]) => {
      if (active) { setCatalog(loadedCatalog); setAreas(loadedAreas); setIslands(loadedIslands) }
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os cadastros.')
    })
    return () => { active = false }
  }, [])

  if (error) return <div className="form-error" role="alert">{error}</div>
  if (!catalog || !areas || !islands) return <div className="form-loading" role="status">Carregando cadastros…</div>

  return <div className="operational-catalog-grid">
    <CreateCard title="Clientes" label="Nome do cliente" placeholder="Ex.: Empresa cliente" maxLength={200}
      entries={catalog.organizations.filter(org => org.kind === 'Client').map(org => org.name)}
      onCreate={async name => {
        const created = await apiRequest<Organization>('/api/catalog/organizations', { method: 'POST', body: JSON.stringify({ name, kind: 'Client' }) })
        setCatalog(current => current ? { ...current, organizations: [...current.organizations, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) } : current)
      }} />
    <CreateCard title="Empresas contratadas" label="Nome da contratada" placeholder="Ex.: Empresa contratada" maxLength={200}
      entries={catalog.organizations.filter(org => org.kind === 'Contractor').map(org => org.name)}
      onCreate={async name => {
        const created = await apiRequest<Organization>('/api/catalog/organizations', { method: 'POST', body: JSON.stringify({ name, kind: 'Contractor' }) })
        setCatalog(current => current ? { ...current, organizations: [...current.organizations, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) } : current)
      }} />
    <ManageCatalog title="Editar clientes" endpoint="/api/catalog/organizations" entries={catalog.organizations.filter(org => org.kind === 'Client')}
      onChanged={saved => setCatalog(current => current ? { ...current, organizations: current.organizations.map(entry => entry.id === saved.id ? saved : entry) } : current)} />
    <CreateCard title="Locais / projetos" label="Nome do projeto" placeholder="Ex.: Unidade ou obra" maxLength={200}
      entries={catalog.sites.map(site => site.name)}
      onCreate={async name => {
        const created = await apiRequest<Site>('/api/catalog/sites', { method: 'POST', body: JSON.stringify({ name, projectOrIsland: null }) })
        setCatalog(current => current ? { ...current, sites: [...current.sites, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) } : current)
      }} />
    <IslandsCard islands={islands} onChanged={island => setIslands(current => current
      ? [...current.filter(entry => entry.id !== island.id), island].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) : current)} />
    <ManageCatalog title="Editar contratadas" endpoint="/api/catalog/organizations" entries={catalog.organizations.filter(org => org.kind === 'Contractor')}
      onChanged={saved => setCatalog(current => current ? { ...current, organizations: current.organizations.map(entry => entry.id === saved.id ? saved : entry) } : current)} />
    <ManageCatalog title="Editar projetos" endpoint="/api/catalog/sites" entries={catalog.sites}
      onChanged={saved => setCatalog(current => current ? { ...current, sites: current.sites.map(entry => entry.id === saved.id ? saved : entry) } : current)} />
    {canCreateArea && <ManageCatalog title="Editar áreas" endpoint="/api/inspection-areas" entries={areas} protectDefault
      onChanged={saved => setAreas(current => current ? current.map(entry => entry.id === saved.id ? saved : entry) : current)} />}
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
