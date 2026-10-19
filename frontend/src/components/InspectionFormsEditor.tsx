import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { apiRequest, defaultInspectionId, type InspectionArea, type InspectionFormTemplate } from '../lib/api'

interface ItemDraft {
  key: string
  name: string
}

interface TopicDraft {
  key: string
  name: string
  items: ItemDraft[]
}

interface FormDraft {
  id: string | null
  expectedVersion: number
  name: string
  areaId: string
  categories: TopicDraft[]
}

function emptyItem(): ItemDraft {
  return { key: crypto.randomUUID(), name: '' }
}

function emptyTopic(): TopicDraft {
  return { key: crypto.randomUUID(), name: '', items: [emptyItem()] }
}

function moveEntry<T>(values: T[], index: number, direction: number) {
  const result = [...values]
  const target = index + direction
  if (target < 0 || target >= result.length) return result
  const entry = result[index]
  result[index] = result[target]
  result[target] = entry
  return result
}

export function InspectionFormsEditor() {
  const [forms, setForms] = useState<InspectionFormTemplate[] | null>(null)
  const [areas, setAreas] = useState<InspectionArea[]>([])
  const [areaName, setAreaName] = useState('')
  const [filterAreaId, setFilterAreaId] = useState('')
  const [isCreatingArea, setIsCreatingArea] = useState(false)
  const [draft, setDraft] = useState<FormDraft | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest<InspectionFormTemplate[]>('/api/inspection-forms'),
      apiRequest<InspectionArea[]>('/api/inspection-areas'),
    ]).then(([loaded, loadedAreas]) => { if (active) { setForms(loaded); setAreas(loadedAreas) } })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os formulários.')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!isDirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  function editForm(template?: InspectionFormTemplate, duplicate = false) {
    setError('')
    setMessage('')
    setIsDirty(false)
    setDraft(template ? {
      id: duplicate ? null : template.id,
      expectedVersion: duplicate ? 0 : template.version,
      name: duplicate ? `${template.name} (cópia)` : template.name,
      areaId: template.areaId,
      categories: template.categories.map((category) => ({
        key: crypto.randomUUID(),
        name: category.name,
        items: category.items.map((item) => ({ key: crypto.randomUUID(), name: item.name })),
      })),
    } : { id: null, expectedVersion: 0, name: '', areaId: filterAreaId || defaultInspectionId, categories: [emptyTopic()] })
  }

  function changeDraft(update: Partial<FormDraft>) {
    setDraft((current) => current ? { ...current, ...update } : current)
    setIsDirty(true)
    setMessage('')
  }

  function updateTopic(key: string, update: Partial<TopicDraft>) {
    if (!draft) return
    changeDraft({ categories: draft.categories.map((category) => category.key === key ? { ...category, ...update } : category) })
  }

  function closeEditor() {
    if (isDirty && !window.confirm('Descartar as alterações ainda não salvas neste formulário?')) return
    setDraft(null)
    setIsDirty(false)
    setError('')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    setError('')
    if (!draft.name.trim() || draft.categories.length === 0
      || draft.categories.some((category) => !category.name.trim() || category.items.length === 0
        || category.items.some((item) => !item.name.trim()))) {
      setError('Informe o nome do formulário e pelo menos um tópico com itens. Preencha todos os nomes.')
      return
    }

    setIsSaving(true)
    try {
      const saved = await apiRequest<InspectionFormTemplate>(
        draft.id ? `/api/inspection-forms/${draft.id}` : '/api/inspection-forms',
        {
          method: draft.id ? 'PUT' : 'POST',
          body: JSON.stringify({
            name: draft.name.trim(),
            expectedVersion: draft.expectedVersion,
            areaId: draft.areaId,
            categories: draft.categories.map((category) => ({
              name: category.name.trim(),
              items: category.items.map((item) => ({ name: item.name.trim() })),
            })),
          }),
        },
      )
      setForms((current) => [...(current ?? []).filter((form) =>
        form.id !== draft.id && !(saved.isDefault && form.isDefault)), saved]
        .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name, 'pt-BR')))
      setDraft(null)
      setIsDirty(false)
      setMessage(`Formulário "${saved.name}" salvo (versão ${saved.version}). As inspeções anteriores permanecem inalteradas.`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o formulário.')
    } finally {
      setIsSaving(false)
    }
  }

  async function createArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCreatingArea(true)
    setError('')
    try {
      const area = await apiRequest<InspectionArea>('/api/inspection-areas', {
        method: 'POST', body: JSON.stringify({ name: areaName.trim() }),
      })
      setAreas(current => [...current, area])
      setFilterAreaId(area.id)
      setAreaName('')
      setMessage(`Área "${area.name}" criada. Agora crie um formulário e escolha esta área.`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Não foi possível criar a área.')
    } finally {
      setIsCreatingArea(false)
    }
  }

  return <section className="panel users-card catalog-editor">
    {error && <div className="form-error" role="alert">{error}</div>}
    {message && <div className="report-save-confirmation" role="status"><Check size={16} />{message}</div>}
    {draft ? <>
      <div className="panel-heading"><div><h2>{draft.id ? 'Editar formulário' : 'Novo formulário de inspeção'}</h2><p>Organize os tópicos e seus itens. Ao salvar, uma nova versão fica disponível para as próximas inspeções, sem alterar o histórico.</p></div></div>
      <form className="inspection-template-form" onSubmit={(event) => void save(event)}>
        <fieldset disabled={isSaving} className="inspection-template-fields">
          <label>Área do formulário
            <select value={draft.areaId} disabled={draft.id !== null} onChange={event => changeDraft({ areaId: event.target.value })}>
              {areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
          </label>
          {draft.id !== null && <p>A área permanece fixa para não misturar o histórico. Para usar outra área, duplique o formulário.</p>}
          <label className="template-name">Nome do formulário
            <input autoFocus maxLength={150} onChange={(event) => changeDraft({ name: event.target.value })} placeholder="Ex.: Inspeção de trabalho em altura" required value={draft.name} />
          </label>
          <div className="template-rules">Todos os formulários usam identificação, pessoas observadas, quantidade, severidade (0,3 · 1 · 3), comentários e contexto, com as mesmas fórmulas de IDS.</div>
          {draft.categories.map((category, topicIndex) => (
            <article className="catalog-category" key={category.key}>
              <div className="catalog-category-heading">
                <label>Tópico {topicIndex + 1}
                  <input aria-label={`Nome do tópico ${topicIndex + 1}`} maxLength={150} onChange={(event) => updateTopic(category.key, { name: event.target.value })} placeholder="Ex.: Equipamentos de proteção" required value={category.name} />
                </label>
                <div className="template-row-actions">
                  <button className="quiet-button" aria-label={`Subir tópico ${topicIndex + 1}`} disabled={topicIndex === 0} onClick={() => changeDraft({ categories: moveEntry(draft.categories, topicIndex, -1) })} type="button"><ArrowUp size={15} /></button>
                  <button className="quiet-button" aria-label={`Descer tópico ${topicIndex + 1}`} disabled={topicIndex === draft.categories.length - 1} onClick={() => changeDraft({ categories: moveEntry(draft.categories, topicIndex, 1) })} type="button"><ArrowDown size={15} /></button>
                  <button className="quiet-button" aria-label={`Remover tópico ${topicIndex + 1}`} onClick={() => changeDraft({ categories: draft.categories.filter((value) => value.key !== category.key) })} type="button"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="catalog-item-list">
                {category.items.map((item, itemIndex) => (
                  <div className="catalog-item-editor" key={item.key}>
                    <input aria-label={`Item ${itemIndex + 1} do tópico ${topicIndex + 1}`} maxLength={200} onChange={(event) => updateTopic(category.key, {
                      items: category.items.map((value) => value.key === item.key ? { ...value, name: event.target.value } : value),
                    })} placeholder="Nome do item observado" required value={item.name} />
                    <div className="template-row-actions">
                      <button className="quiet-button" aria-label={`Subir item ${itemIndex + 1} do tópico ${topicIndex + 1}`} disabled={itemIndex === 0} onClick={() => updateTopic(category.key, { items: moveEntry(category.items, itemIndex, -1) })} type="button"><ArrowUp size={14} /></button>
                      <button className="quiet-button" aria-label={`Descer item ${itemIndex + 1} do tópico ${topicIndex + 1}`} disabled={itemIndex === category.items.length - 1} onClick={() => updateTopic(category.key, { items: moveEntry(category.items, itemIndex, 1) })} type="button"><ArrowDown size={14} /></button>
                      <button className="quiet-button" aria-label={`Remover item ${itemIndex + 1} do tópico ${topicIndex + 1}`} onClick={() => updateTopic(category.key, { items: category.items.filter((value) => value.key !== item.key) })} type="button"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
                <div><button className="outline-button" onClick={() => updateTopic(category.key, { items: [...category.items, emptyItem()] })} type="button"><Plus size={15} />Adicionar item neste tópico</button></div>
              </div>
            </article>
          ))}
          <div><button className="outline-button" onClick={() => changeDraft({ categories: [...draft.categories, emptyTopic()] })} type="button"><Plus size={16} />Adicionar tópico</button></div>
          <div className="template-footer">
            <button className="outline-button" onClick={closeEditor} type="button"><ArrowLeft size={15} />Voltar aos formulários</button>
            <button className="primary-button" type="submit"><Save size={16} />{isSaving ? 'Salvando…' : 'Salvar formulário'}</button>
          </div>
        </fieldset>
      </form>
    </> : <>
      <form className="inspection-area-create form-fields" onSubmit={event => void createArea(event)}>
        <label>Nova área<input required maxLength={150} value={areaName} disabled={isCreatingArea} onChange={event => setAreaName(event.target.value)} placeholder="Ex.: Meio Ambiente ou Qualidade" /></label>
        <button type="submit" className="outline-button" disabled={isCreatingArea}>{isCreatingArea ? 'Criando…' : 'Criar área'}</button>
        <p>Áreas cadastradas: {areas.map(area => area.name).join(' · ')}</p>
      </form>
      <div className="panel-heading"><div><h2>Seus formulários de inspeção</h2><p>Crie modelos completos ou edite um formulário salvo. Cada modelo tem seus próprios tópicos e itens e segue as mesmas regras de estatística.</p></div></div>
      <div className="form-fields"><label>Área dos formulários<select value={filterAreaId} onChange={event => setFilterAreaId(event.target.value)}>
        <option value="">Todas as áreas</option>{areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
      </select></label></div>
      <div><button className="primary-button" onClick={() => editForm()} type="button"><Plus size={16} />Novo formulário</button></div>
      {!forms && !error && <div className="form-loading" role="status">Carregando formulários…</div>}
      <div className="inspection-template-list">
        {forms?.filter(form => !filterAreaId || form.areaId === filterAreaId).map((form) => <article className="inspection-template-card" key={form.id}>
          <div><h3>{form.name}</h3><p>{form.areaName}</p><p>{form.categories.length} tópicos · {form.categories.reduce((sum, category) => sum + category.items.length, 0)} itens · {form.version ? `Versão ${form.version}` : 'Modelo original'}{form.isDefault ? ' · Padrão' : ''}</p></div>
          <div className="template-row-actions">
            <button className="outline-button" onClick={() => editForm(form)} type="button"><Pencil size={15} />Editar</button>
            <button className="outline-button" onClick={() => editForm(form, true)} type="button"><Copy size={15} />Duplicar</button>
          </div>
          {forms && filterAreaId && !forms.some(form => form.areaId === filterAreaId) && <p role="status">Nenhum formulário nesta área. Use Novo formulário para criar o primeiro.</p>}
        </article>)}
      </div>
    </>}
  </section>
}
