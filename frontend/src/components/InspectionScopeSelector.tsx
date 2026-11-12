import { useEffect, useState } from 'react'
import { apiRequest, defaultInspectionId, type InspectionArea, type InspectionScope, type InspectionFormTemplate, type InspectionIsland, type ChecklistCatalog } from '../lib/api'

export function InspectionScopeSelector({ onChange, includeOrganizationFilters = false }: { onChange: (scope: InspectionScope | null) => void; includeOrganizationFilters?: boolean }) {
  const [areas, setAreas] = useState<InspectionArea[]>([])
  const [forms, setForms] = useState<InspectionFormTemplate[]>([])
  const [islands, setIslands] = useState<InspectionIsland[]>([])
  const [islandId, setIslandId] = useState('')
  const [siteId, setSiteId] = useState('')
  const [contractorId, setContractorId] = useState('')
  const [catalog, setCatalog] = useState<ChecklistCatalog | null>(null)
  const [areaId, setAreaId] = useState(defaultInspectionId)
  const [formId, setFormId] = useState(defaultInspectionId)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest<InspectionArea[]>('/api/inspection-areas'),
      apiRequest<InspectionFormTemplate[]>('/api/inspection-forms'),
      apiRequest<InspectionIsland[]>('/api/inspection-islands'),
      includeOrganizationFilters ? apiRequest<ChecklistCatalog>('/api/catalog') : Promise.resolve(null),
    ]).then(([loadedAreas, loadedForms, loadedIslands, loadedCatalog]) => {
      if (!active) return
      setAreas(loadedAreas)
      setForms(loadedForms)
      setIslands(loadedIslands)
      setCatalog(loadedCatalog)
      setLoaded(true)
      const first = loadedForms.find(form => form.isDefault)
      onChange(first ? { areaId: first.areaId, areaName: first.areaName, formId: defaultInspectionId, formName: first.name } : null)
    }).catch((loadError: unknown) => {
      if (!active) return
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as áreas e formulários.')
      onChange(null)
    })
    return () => { active = false }
  }, [onChange, includeOrganizationFilters])

  const availableForms = forms.filter(form => form.areaId === areaId)

  function select(area: string, form: InspectionFormTemplate | undefined, island = islandId, site = siteId, contractor = contractorId) {
    const id = form?.isDefault ? defaultInspectionId : form?.id ?? ''
    setAreaId(area)
    setFormId(id)
    onChange(form ? { areaId: area, areaName: form.areaName, formId: id, formName: form.name, islandId: island, islandName: islands.find(value => value.id === island)?.name, siteId: site, contractorId: contractor } : null)
  }

  return <section className="panel inspection-scope-filter" aria-label="Separação por área e formulário">
    <div className="form-fields form-fields-two">
      <label>Área dos resultados<select disabled={!loaded} value={areaId} onChange={event => {
        const id = event.target.value
        select(id, forms.find(form => form.areaId === id))
      }}>{areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
      <label>Tipo de formulário<select disabled={!loaded || availableForms.length === 0} value={formId} onChange={event => {
        select(areaId, availableForms.find(form => (form.isDefault ? defaultInspectionId : form.id) === event.target.value))
      }}>{availableForms.length === 0 && <option value="">Nenhum formulário nesta área</option>}{availableForms.map(form =>
        <option key={form.id} value={form.isDefault ? defaultInspectionId : form.id}>{form.name}</option>)}</select></label>
      <label>Local / ilha<select disabled={!loaded} value={islandId} onChange={event => {
        const id = event.target.value
        setIslandId(id)
        select(areaId, availableForms.find(form => (form.isDefault ? defaultInspectionId : form.id) === formId), id)
      }}><option value="">Todas as ilhas</option>{islands.map(island => <option key={island.id} value={island.id}>{island.name}{!island.isActive ? ' (desativada)' : ''}</option>)}</select></label>
      {includeOrganizationFilters && <><label>Local / projeto<select disabled={!loaded} value={siteId} onChange={event => {
        const id = event.target.value; setSiteId(id); select(areaId, availableForms.find(form => (form.isDefault ? defaultInspectionId : form.id) === formId), islandId, id)
      }}><option value="">Todos os projetos</option>{catalog?.sites.map(site => <option key={site.id} value={site.id}>{site.name}{!site.isActive ? ' (desativado)' : ''}</option>)}</select></label>
      <label>Contratada<select disabled={!loaded} value={contractorId} onChange={event => {
        const id = event.target.value; setContractorId(id); select(areaId, availableForms.find(form => (form.isDefault ? defaultInspectionId : form.id) === formId), islandId, siteId, id)
      }}><option value="">Todas as contratadas</option>{catalog?.organizations.filter(org => org.kind === 'Contractor').map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label></>}
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {loaded && availableForms.length === 0 && <p role="status">Crie um formulário nesta área em Formulários de inspeção para consultar seus resultados.</p>}
    <p>Os resultados consideram somente a área e o tipo selecionados, reunindo suas versões sem alterar o histórico.</p>
  </section>
}
