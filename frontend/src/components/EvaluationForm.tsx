import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, ArrowLeft, Check, Save, X } from 'lucide-react'
import { CatalogPicker, type CatalogChoice } from './CatalogPicker'
import { apiRequest, defaultInspectionId, type InspectionScope, type ChecklistCatalog, type EvaluationResult, type InspectionFormTemplate } from '../lib/api'

interface EvaluationFormProps {
  evaluationId?: string
  initialScope?: InspectionScope
  onClose: () => void
  onCreated: (evaluation: EvaluationResult) => void
}

interface ObservationDraft {
  quantity: string
  severityLevelId: string
  comment: string
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function EvaluationForm({ evaluationId, initialScope, onClose, onCreated }: EvaluationFormProps) {
  const [catalog, setCatalog] = useState<ChecklistCatalog | null>(null)
  const [templates, setTemplates] = useState<InspectionFormTemplate[]>([])
  const [formVersionId, setFormVersionId] = useState<string | null>(null)
  const [formName, setFormName] = useState('Formulário padrão')
  const [formVersion, setFormVersion] = useState(0)
  const [areaId, setAreaId] = useState(defaultInspectionId)
  const [areaName, setAreaName] = useState('Saúde e Segurança do Trabalho')
  const [isChangingForm, setIsChangingForm] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null)
  const [evaluationDate, setEvaluationDate] = useState(today)
  const [evaluationTime, setEvaluationTime] = useState('')
  const [siteId, setSiteId] = useState('')
  const [clientId, setClientId] = useState('')
  const [contractorId, setContractorId] = useState('')
  const [subcontractorId, setSubcontractorId] = useState('')
  const [leadAuditorName, setLeadAuditorName] = useState('')
  const [auditorName, setAuditorName] = useState('')
  const [companionName, setCompanionName] = useState('')
  const [observedPeople, setObservedPeople] = useState('')
  const [strengths, setStrengths] = useState('')
  const [improvementOpportunities, setImprovementOpportunities] = useState('')
  const [observations, setObservations] = useState<Record<string, ObservationDraft>>({})

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest<InspectionFormTemplate[]>('/api/inspection-forms'),
      evaluationId ? apiRequest<EvaluationResult>(`/api/evaluations/${evaluationId}`) : Promise.resolve(null),
    ])
      .then(async ([loadedTemplates, existing]) => {
        const selected = loadedTemplates.find(template => initialScope && template.areaId === initialScope.areaId
          && (template.isDefault ? defaultInspectionId : template.id) === initialScope.formId)
          ?? loadedTemplates.find((template) => template.isDefault) ?? loadedTemplates[0]
        if (!existing && !selected) throw new Error('Nenhum formulário de inspeção está disponível.')
        const versionId = existing ? existing.formVersionId : selected.versionId
        const loadedCatalog = await apiRequest<ChecklistCatalog>(
          versionId ? `/api/catalog?formVersionId=${versionId}` : '/api/catalog',
        )
        if (!active) return
        setCatalog(loadedCatalog)
        setTemplates(loadedTemplates)
        setFormVersionId(versionId)
        setFormName(existing ? existing.formName : selected.name)
        setFormVersion(existing ? existing.formVersion : selected.version)
        setAreaId(existing ? existing.areaId : selected.areaId)
        setAreaName(existing ? existing.areaName : selected.areaName)
        if (!existing) return

        setEvaluationDate(existing.evaluationDate)
        setEvaluationTime(existing.evaluationTime?.slice(0, 5) ?? '')
        setSiteId(existing.siteId ?? '')
        setClientId(existing.clientOrganizationId ?? '')
        setContractorId(existing.contractorOrganizationId ?? '')
        setSubcontractorId(existing.subcontractorOrganizationId ?? '')
        setLeadAuditorName(existing.leadAuditorName ?? '')
        setAuditorName(existing.auditorName ?? '')
        setCompanionName(existing.companionName ?? '')
        setObservedPeople(existing.indicators.observedPeople?.toString() ?? '')
        setStrengths(existing.strengths ?? '')
        setImprovementOpportunities(existing.improvementOpportunities ?? '')
        setObservations(Object.fromEntries(existing.observations.map((observation) => {
          const severity = loadedCatalog.severities.find((candidate) => candidate.weight === observation.severityWeight)
          return [observation.checklistItemId, {
            quantity: observation.quantity?.toString() ?? '',
            severityLevelId: severity?.id ?? '',
            comment: observation.comment ?? '',
          }]
        })))
      })
      .catch((error: unknown) => {
        if (active) setCatalogError(error instanceof Error ? error.message : 'Não foi possível carregar o catálogo.')
      })
      .finally(() => { if (active) setIsLoadingCatalog(false) })
    return () => { active = false }
  }, [evaluationId, initialScope])

  async function changeForm(value: string) {
    const selected = templates.find((template) => (template.versionId ?? 'legacy') === value)
    if (!selected) return
    if (Object.values(observations).some((observation) => observation.quantity !== ''
      || observation.severityLevelId !== '' || observation.comment.trim() !== '')
      && !window.confirm('Trocar o formulário descarta as observações preenchidas. Deseja continuar?')) return
    setIsChangingForm(true)
    setSubmitError('')
    try {
      const loadedCatalog = await apiRequest<ChecklistCatalog>(selected.versionId
        ? `/api/catalog?formVersionId=${selected.versionId}` : '/api/catalog')
      setCatalog(loadedCatalog)
      setFormVersionId(selected.versionId)
      setFormName(selected.name)
      setFormVersion(selected.version)
      setAreaId(selected.areaId)
      setAreaName(selected.areaName)
      setObservations({})
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível carregar o formulário selecionado.')
    } finally {
      setIsChangingForm(false)
    }
  }

  function updateObservation(itemId: string, update: Partial<ObservationDraft>) {
    setObservations((current) => {
      const existing = current[itemId] ?? { quantity: '', severityLevelId: '', comment: '' }
      return { ...current, [itemId]: { ...existing, ...update } }
    })
  }

  function isIncomplete(itemId: string) {
    const value = observations[itemId]
    return Boolean(value && ((value.quantity !== '') !== (value.severityLevelId !== '')))
  }

  async function createOrganization(name: string, kind: 'Client' | 'Contractor' | 'Subcontractor'): Promise<CatalogChoice> {
    const created = await apiRequest<{ id: string; name: string }>('/api/catalog/organizations', {
      method: 'POST',
      body: JSON.stringify({ name, kind }),
    })
    const organization = { ...created, kind }
    setCatalog((current) => current
      ? { ...current, organizations: [...current.organizations, organization].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')) }
      : current)
    return { id: created.id, label: created.name }
  }

  async function createSite(name: string, projectOrIsland: string): Promise<CatalogChoice> {
    const created = await apiRequest<{ id: string; name: string; projectOrIsland: string | null }>('/api/catalog/sites', {
      method: 'POST',
      body: JSON.stringify({ name, projectOrIsland: projectOrIsland || null }),
    })
    setCatalog((current) => current
      ? { ...current, sites: [...current.sites, created].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')) }
      : current)
    return { id: created.id, label: created.projectOrIsland ? `${created.name} · ${created.projectOrIsland}` : created.name }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!catalog) return
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const shouldSubmit = submitter?.value === 'submit'
    setSubmitError('')
    setIsSaving(true)

    try {
      const request = {
        formVersionId,
        evaluationDate,
        evaluationTime: evaluationTime || null,
        siteId: siteId || null,
        clientOrganizationId: clientId || null,
        contractorOrganizationId: contractorId || null,
        subcontractorOrganizationId: subcontractorId || null,
        leadAuditorName: leadAuditorName || null,
        auditorName: auditorName || null,
        companionName: companionName || null,
        observedPeople: observedPeople === '' ? null : Number(observedPeople),
        strengths: strengths || null,
        improvementOpportunities: improvementOpportunities || null,
        observations: catalog.categories.flatMap((category) => category.items.flatMap((item) => {
          const value = observations[item.id]
          if (!value || (value.quantity === '' && value.severityLevelId === '' && value.comment.trim() === '')) return []
          return [{
            checklistItemId: item.id,
            quantity: value.quantity === '' ? null : Number(value.quantity),
            severityLevelId: value.severityLevelId || null,
            comment: value.comment || null,
          }]
        })),
      }

      const currentEvaluationId = evaluationId ?? createdDraftId
      let evaluation = await apiRequest<EvaluationResult>(
        currentEvaluationId ? `/api/evaluations/${currentEvaluationId}` : '/api/evaluations',
        {
          method: currentEvaluationId ? 'PUT' : 'POST',
          body: JSON.stringify(request),
        },
      )

      if (!currentEvaluationId && shouldSubmit) {
        setCreatedDraftId(evaluation.id)
      }

      if (shouldSubmit) {
        evaluation = await apiRequest<EvaluationResult>(`/api/evaluations/${evaluation.id}/submit`, { method: 'POST' })
      }

      onCreated(evaluation)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível salvar a avaliação.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="evaluation-form-shell">
      <div className="evaluation-form-heading">
        <button className="back-button" type="button" onClick={onClose}><ArrowLeft size={16} /> Voltar</button>
        <button className="close-button" type="button" aria-label="Fechar avaliação" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="evaluation-form-title"><span className="eyebrow">REGISTRO DE CAMPO</span><h2>{evaluationId ? 'Editar avaliação' : 'Nova avaliação'}</h2><p>Os indicadores são calculados no servidor após salvar.</p></div>

      {catalogError && <div className="form-error" role="alert">{catalogError}</div>}
      {isLoadingCatalog && <div className="form-loading">Carregando os itens da avaliação…</div>}

      {!isLoadingCatalog && catalog && <form className="evaluation-form" onSubmit={handleSubmit}>
        <section className="form-section">
          <div className="form-section-heading"><span>00</span><div><h3>Formulário de inspeção</h3><p>{evaluationId || createdDraftId ? 'Esta inspeção mantém a versão original do formulário, mesmo após alterações no modelo.' : 'Escolha o modelo. Todos usam as mesmas regras de cálculo.'}</p></div></div>
          <div className="form-fields">
            <label>Área da inspeção
              {evaluationId || createdDraftId ? <input disabled value={areaName} /> : <select
                disabled={isSaving || isChangingForm} value={areaId} onChange={event => {
                  const first = templates.find(template => template.areaId === event.target.value)
                  if (first) void changeForm(first.versionId ?? 'legacy')
                }}>
                {[...new Map(templates.map(template => [template.areaId, template.areaName])).entries()]
                  .map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>}
            </label>
            <label>Modelo de formulário
              {evaluationId || createdDraftId
                ? <input disabled value={`${formName} · ${formVersion ? `versão ${formVersion}` : 'modelo original'}`} />
                : <select disabled={isSaving || isChangingForm} onChange={(event) => void changeForm(event.target.value)} value={formVersionId ?? 'legacy'}>
                  {templates.filter(template => template.areaId === areaId).map((template) => <option key={template.id} value={template.versionId ?? 'legacy'}>{template.name} · {template.version ? `versão ${template.version}` : 'modelo original'}</option>)}
                </select>}
            </label>
          </div>
          {isChangingForm && <p role="status">Carregando formulário…</p>}
        </section>
        <section className="form-section">
          <div className="form-section-heading"><span>01</span><div><h3>Identificação</h3><p>Dados do local, período e responsáveis.</p></div></div>
          <div className="form-fields form-fields-three">
            <label>Data da avaliação<input onChange={(event) => setEvaluationDate(event.target.value)} required type="date" value={evaluationDate} /></label>
            <label>Hora<input onChange={(event) => setEvaluationTime(event.target.value)} type="time" value={evaluationTime} /></label>
            <label>Pessoas observadas<input onChange={(event) => setObservedPeople(event.target.value)} step="any" type="number" value={observedPeople} /></label>
            <CatalogPicker label="Local / projeto" placeholder="Selecionar local" value={siteId} options={catalog.sites.map((site) => ({ id: site.id, label: site.projectOrIsland ? `${site.name} · ${site.projectOrIsland}` : site.name }))} onChange={setSiteId} createTitle="Novo local" createSecondaryLabel="Projeto / ilha (opcional)" onCreate={createSite} />
            <CatalogPicker label="Cliente" placeholder="Selecionar cliente" value={clientId} options={catalog.organizations.filter((organization) => organization.kind === 'Client').map((organization) => ({ id: organization.id, label: organization.name }))} onChange={setClientId} createTitle="Novo cliente" onCreate={(name) => createOrganization(name, 'Client')} />
            <CatalogPicker label="Contratada" placeholder="Selecionar contratada" value={contractorId} options={catalog.organizations.filter((organization) => organization.kind === 'Contractor').map((organization) => ({ id: organization.id, label: organization.name }))} onChange={setContractorId} createTitle="Nova contratada" onCreate={(name) => createOrganization(name, 'Contractor')} />
            <CatalogPicker label="Subcontratada" placeholder="Selecionar subcontratada" value={subcontractorId} options={catalog.organizations.filter((organization) => organization.kind === 'Subcontractor').map((organization) => ({ id: organization.id, label: organization.name }))} onChange={setSubcontractorId} createTitle="Nova subcontratada" onCreate={(name) => createOrganization(name, 'Subcontractor')} />
            <label>Auditor líder<input onChange={(event) => setLeadAuditorName(event.target.value)} value={leadAuditorName} /></label>
            <label>Auditor<input onChange={(event) => setAuditorName(event.target.value)} value={auditorName} /></label>
            <label>Acompanhante<input onChange={(event) => setCompanionName(event.target.value)} value={companionName} /></label>
          </div>
        </section>

        <fieldset disabled={isChangingForm || isSaving} className="form-section checklist-section inspection-observations">
          <div className="form-section-heading"><span>02</span><div><h3>Observações</h3><p>Quantidade e peso reproduzem os campos de entrada da planilha.</p></div></div>
          <div className="checklist-head"><span>Item observado</span><span>Quantidade</span><span>Severidade</span><span>Comentário</span></div>
          {catalog.categories.map((category) => (
            <fieldset className="checklist-category" key={category.id}>
              <legend>{category.name}<span>{category.items.length} itens</span></legend>
              {category.items.map((item) => (
                <div className={`checklist-row ${isIncomplete(item.id) ? 'incomplete' : ''}`} key={item.id}>
                  <span className="checklist-item-name">{item.name}{isIncomplete(item.id) && <AlertTriangle size={14} aria-label="Quantidade ou severidade pendente" />}</span>
                  <input aria-label={`Quantidade: ${item.name}`} onChange={(event) => updateObservation(item.id, { quantity: event.target.value })} step="any" type="number" value={observations[item.id]?.quantity ?? ''} />
                  <select aria-label={`Severidade: ${item.name}`} onChange={(event) => updateObservation(item.id, { severityLevelId: event.target.value })} value={observations[item.id]?.severityLevelId ?? ''}>
                    <option value="">Selecionar</option>{catalog.severities.map((severity) => <option key={severity.id} value={severity.id}>{severity.name} · {severity.weight.toLocaleString('pt-BR')}</option>)}
                  </select>
                  <input aria-label={`Comentário: ${item.name}`} maxLength={2000} onChange={(event) => updateObservation(item.id, { comment: event.target.value })} placeholder="Opcional" value={observations[item.id]?.comment ?? ''} />
                </div>
              ))}
            </fieldset>
          ))}
        </fieldset>

        <section className="form-section">
          <div className="form-section-heading"><span>03</span><div><h3>Contexto</h3><p>Registre os pontos relevantes observados.</p></div></div>
          <div className="form-fields form-fields-two"><label>Pontos fortes<textarea maxLength={4000} onChange={(event) => setStrengths(event.target.value)} rows={3} value={strengths} /></label><label>Oportunidades de melhoria<textarea maxLength={4000} onChange={(event) => setImprovementOpportunities(event.target.value)} rows={3} value={improvementOpportunities} /></label></div>
        </section>

        {submitError && <div className="form-error" role="alert">{submitError}</div>}
        <div className="form-submit-row"><span>Itens incompletos podem ser enviados com aviso, como na planilha.</span><div className="evaluation-actions"><button className="outline-button" disabled={isSaving || isChangingForm} name="intent" type="submit" value="draft"><Save size={16} />{isSaving ? 'Salvando…' : 'Salvar rascunho'}</button><button className="primary-button" disabled={isSaving || isChangingForm} name="intent" type="submit" value="submit"><Check size={16} />{isSaving ? 'Enviando…' : 'Enviar avaliação'}</button></div></div>
      </form>}
    </div>
  )
}