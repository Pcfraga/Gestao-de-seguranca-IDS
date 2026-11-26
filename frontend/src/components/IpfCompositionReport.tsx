import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { ApiError, apiRequest, defaultInspectionId, type ChecklistCatalog, type InspectionArea } from '../lib/api'

interface WeightDraft {
  areaId: string
  weight: string
}

interface ProjectComposition {
  siteId: string
  areas: Array<{ areaId: string; weight: number }>
}

export function IpfCompositionReport({ initialAreaId, canSave }: { month: string; initialAreaId?: string; canSave: boolean }) {
  const [references, setReferences] = useState<{ areas: InspectionArea[]; catalog: ChecklistCatalog } | null>(null)
  const [siteId, setSiteId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest<InspectionArea[]>('/api/inspection-areas'),
      apiRequest<ChecklistCatalog>('/api/catalog'),
    ]).then(([areas, catalog]) => {
      if (active) setReferences({ areas, catalog })
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as disciplinas e projetos.')
    })
    return () => { active = false }
  }, [])

  return <section className="report-layout">
    <div className="report-intro"><div>
      <span className="report-step">IDS POR DISCIPLINAS</span>
      <h2>Composição das disciplinas por projeto</h2>
      <p>Defina os pesos de cada projeto. Eles são usados nos novos cálculos de cada contratada e permanecem válidos até serem alterados.</p>
    </div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {!references && !error && <p role="status">Carregando disciplinas e projetos…</p>}
    <div className="form-fields panel ipf-composition-filter"><label>Projeto
      <select disabled={!references} value={siteId} onChange={event => setSiteId(event.target.value)}>
        <option value="">Selecionar projeto</option>
        {references?.catalog.sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
      </select>
    </label></div>
    {references && siteId
      ? <ProjectWeights key={siteId} siteId={siteId} areas={references.areas} initialAreaId={initialAreaId} canSave={canSave} />
      : references && <div className="report-empty panel">Selecione um projeto para definir a composição.</div>}
  </section>
}

function ProjectWeights({ siteId, areas, initialAreaId, canSave }: {
  siteId: string
  areas: InspectionArea[]
  initialAreaId?: string
  canSave: boolean
}) {
  const [draft, setDraft] = useState<WeightDraft[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    apiRequest<ProjectComposition>(`/api/monthly-close-compositions/${siteId}`)
      .then(composition => {
        if (active) setDraft(composition.areas.map(area => ({ areaId: area.areaId, weight: String(area.weight) })))
      })
      .catch((loadError: unknown) => {
        if (!active) return
        if (loadError instanceof ApiError && loadError.status === 404) {
          setDraft([{ areaId: areas.find(area => area.id === initialAreaId)?.id ?? areas[0]?.id ?? defaultInspectionId, weight: '100' }])
          setMessage('Este projeto ainda não possui composição salva.')
        } else {
          setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a composição do projeto.')
        }
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [siteId, areas, initialAreaId])

  function changeDraft(updated: WeightDraft[]) {
    setDraft(updated)
    setMessage('')
    setError('')
  }

  const total = draft.reduce((sum, row) => sum + (Number(row.weight) || 0), 0)
  const valid = draft.length >= 1 && draft.length <= 4
    && draft.every(row => row.weight.trim() !== '' && /^\d+(\.\d{1,2})?$/.test(row.weight)
      && Number(row.weight) >= 0 && Number(row.weight) <= 100)
    && draft.reduce((sum, row) => sum + Math.round(Number(row.weight) * 100), 0) === 10000
    && new Set(draft.map(row => row.areaId)).size === draft.length

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || !canSave) return
    setIsSaving(true)
    setError('')
    setMessage('')
    try {
      await apiRequest<ProjectComposition>(`/api/monthly-close-compositions/${siteId}`, {
        method: 'PUT',
        body: JSON.stringify({ areas: draft.map(row => ({ areaId: row.areaId, weight: Number(row.weight) })) }),
      })
      setMessage('Composição salva. Os fechamentos já salvos permanecem inalterados até serem recalculados e salvos novamente.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a composição.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <p role="status">Carregando composição do projeto…</p>
  return <>
    {error && <div className="form-error" role="alert">{error}</div>}
    {message && <div className="report-save-confirmation" role="status">{message}</div>}
    {draft.length > 0 && <form className="report-entry-card" onSubmit={event => void save(event)}>
      <div className="report-entry-heading"><div><span className="report-step">PESOS DAS DISCIPLINAS</span>
        <h3>Composição do projeto</h3><p>Distribua 100% entre uma a quatro disciplinas.</p>
      </div></div>
      <fieldset disabled={isSaving || !canSave} className="ipf-composition-fields">
        {draft.map((row, index) => <div className="ipf-weight-row" key={index}>
          <label>Disciplina {index + 1}<select value={row.areaId} onChange={event =>
            changeDraft(draft.map((entry, position) => position === index ? { ...entry, areaId: event.target.value } : entry))}>
            {areas.filter(area => area.id === row.areaId || !draft.some(entry => entry.areaId === area.id))
              .map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
          </select></label>
          <label>Peso da disciplina {index + 1} (%)<input type="number" required min={0} max={100} step="0.01" value={row.weight}
            onChange={event => changeDraft(draft.map((entry, position) => position === index ? { ...entry, weight: event.target.value } : entry))} /></label>
          <button type="button" className="outline-button" aria-label={`Remover disciplina ${index + 1}`} disabled={draft.length === 1}
            onClick={() => {
              const remaining = draft.filter((_, position) => position !== index)
              changeDraft(remaining.length === 1 ? [{ ...remaining[0], weight: '100' }] : remaining)
            }}><Trash2 size={16} /></button>
        </div>)}
        <div className="ipf-composition-actions">
          <button type="button" className="outline-button" disabled={draft.length >= 4 || draft.length >= areas.length}
            onClick={() => {
              const next = areas.find(area => !draft.some(row => row.areaId === area.id))
              if (next) changeDraft([...draft, { areaId: next.id, weight: '0' }])
            }}><Plus size={16} />Adicionar disciplina</button>
          <strong>Total definido: {total.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</strong>
        </div>
        {!valid && <p role="alert">Selecione disciplinas distintas e informe pesos que somem 100%.</p>}
        <p className="ipf-composition-rule">Disciplinas sem média ou com peso zero não participam. Os demais pesos são redistribuídos proporcionalmente; uma média igual a zero participa normalmente.</p>
        {canSave && <button className="primary-button" type="submit" disabled={!valid || isSaving}><Save size={16} />{isSaving ? 'Salvando…' : 'Salvar composição do projeto'}</button>}
      </fieldset>
      {!canSave && <p className="ipf-composition-rule">Somente Administrador e Gestor podem salvar a composição.</p>}
    </form>}
  </>
}
