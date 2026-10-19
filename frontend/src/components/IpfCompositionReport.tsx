import { useEffect, useState, type FormEvent } from 'react'
import { FileDown, Plus, Save, Trash2 } from 'lucide-react'
import {
  apiRequest, defaultInspectionId, type ChecklistCatalog, type InspectionArea,
  type IpfComposition, type IpfCompositionHistory,
} from '../lib/api'
import { ipfCompositionPdf, openPrintWindow } from '../lib/pdf'

interface WeightDraft {
  areaId: string
  weight: string
}

function formatValue(value: number | null) {
  return value === null ? 'Sem média' : value.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
}

export function IpfCompositionReport({ month, initialAreaId }: { month: string; initialAreaId?: string }) {
  const [references, setReferences] = useState<{ areas: InspectionArea[]; catalog: ChecklistCatalog } | null>(null)
  const [contractorId, setContractorId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest<InspectionArea[]>('/api/inspection-areas'),
      apiRequest<ChecklistCatalog>('/api/catalog'),
    ]).then(([areas, catalog]) => {
      if (active) setReferences({ areas, catalog })
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as áreas e contratadas.')
    })
    return () => { active = false }
  }, [])

  return <section className="report-layout">
    <div className="report-intro"><div>
      <span className="report-step">IPF POR DISCIPLINAS</span>
      <h2>Compor a nota da contratada</h2>
      <p>Escolha de uma a quatro áreas. Cada média reúne todos os formulários da área para a contratada e o mês, sem usar o filtro de tipo de formulário.</p>
    </div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {!references && !error && <p role="status">Carregando áreas e contratadas…</p>}
    <div className="form-fields panel ipf-composition-filter"><label>Contratada do IPF por disciplinas
      <select disabled={!references} value={contractorId} onChange={event => setContractorId(event.target.value)}>
        <option value="">Selecionar contratada</option>
        {references?.catalog.organizations.filter(organization => organization.kind === 'Contractor')
          .map(organization => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
      </select>
    </label></div>
    {references && contractorId
      ? <CompositionWorkspace key={`${contractorId}-${month}`} month={month} contractorId={contractorId}
        areas={references.areas} initialAreaId={initialAreaId} />
      : references && <div className="report-empty panel">Selecione uma contratada para calcular ou consultar seu IPF por disciplinas.</div>}
  </section>
}

function CompositionWorkspace({ month, contractorId, areas, initialAreaId }: {
  month: string
  contractorId: string
  areas: InspectionArea[]
  initialAreaId?: string
}) {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(5, 7))
  const [history, setHistory] = useState<IpfCompositionHistory | null>(null)
  const [draft, setDraft] = useState<WeightDraft[]>([])
  const [result, setResult] = useState<IpfComposition | null>(null)
  const [resultIsSaved, setResultIsSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [viewedMonth, setViewedMonth] = useState<IpfComposition | null>(null)

  useEffect(() => {
    let active = true
    apiRequest<IpfCompositionHistory>(`/api/reports/ipf-composition/${year}?contractorId=${contractorId}`)
      .then(loaded => {
        if (!active) return
        setHistory(loaded)
        const saved = loaded.months.find(record => record.month === monthNumber)
        const previous = loaded.months.filter(record => record.month < monthNumber)
          .sort((left, right) => right.month - left.month)[0]
        const configuration = saved ?? previous
        setDraft(configuration ? configuration.areas.map(area => ({ areaId: area.areaId, weight: String(area.weight) }))
          : [{ areaId: areas.find(area => area.id === initialAreaId)?.id ?? defaultInspectionId, weight: '100' }])
        setResult(saved ?? null)
        setResultIsSaved(Boolean(saved))
        if (!saved && previous) setMessage('Pesos copiados do último mês registrado. Calcule para consultar as médias do mês atual.')
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o histórico por disciplinas.')
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [year, monthNumber, contractorId, areas, initialAreaId])

  function changeDraft(updated: WeightDraft[]) {
    setDraft(updated)
    setResult(null)
    setResultIsSaved(false)
    setError('')
    setMessage('')
    setViewedMonth(null)
  }

  const totalWeight = draft.reduce((total, row) => total + (Number(row.weight) || 0), 0)
  const weightHundredths = draft.map(row => Math.round(Number(row.weight) * 100))
  const validWeights = draft.length >= 1 && draft.length <= 4
    && draft.every(row => row.weight.trim() !== '' && Number.isFinite(Number(row.weight))
      && /^\d+(\.\d{1,2})?$/.test(row.weight) && Number(row.weight) >= 0 && Number(row.weight) <= 100)
    && weightHundredths.reduce((total, weight) => total + weight, 0) === 10000
    && new Set(draft.map(row => row.areaId)).size === draft.length

  async function calculate(save: boolean) {
    if (!validWeights) {
      setError('Escolha de uma a quatro áreas distintas, com pesos entre 0% e 100% somando 100%.')
      return
    }
    if (save && !window.confirm(`Salvar o IPF por disciplinas de ${month} para ${history?.contractor}? As médias serão recalculadas agora e o registro anterior deste mês será substituído, se existir.`)) return
    setIsBusy(true)
    setError('')
    setMessage('')
    setViewedMonth(null)
    try {
      const calculated = await apiRequest<IpfComposition>(`/api/reports/ipf-composition/${year}/${monthNumber}${save ? '' : '/preview'}`, {
        method: save ? 'PUT' : 'POST',
        body: JSON.stringify({ contractorOrganizationId: contractorId, areas: draft.map(row => ({ areaId: row.areaId, weight: Number(row.weight) })) }),
      })
      setResult(calculated)
      setResultIsSaved(save)
      if (save) {
        setHistory(current => {
          if (!current) return current
          const months = [...current.months.filter(record => record.month !== calculated.month), calculated]
            .sort((left, right) => left.month - right.month)
          const values = months.flatMap(record => record.value === null ? [] : [record.value])
          return { ...current, months, annualAverage: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null }
        })
        setMessage('IPF por disciplinas salvo com as médias e os pesos usados. Os registros manuais por formulário não foram alterados.')
      } else if (calculated.value === null) {
        setMessage('Nenhuma área com peso positivo tem média válida neste mês. Não há nota para salvar.')
      }
    } catch (requestError) {
      setResult(null)
      setResultIsSaved(false)
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível calcular ou salvar o IPF.')
    } finally {
      setIsBusy(false)
    }
  }

  function exportPdf(record: IpfComposition) {
    const pdf = ipfCompositionPdf(record)
    if (!openPrintWindow(pdf.title, pdf.content)) setError('O navegador bloqueou o PDF. Permita pop-ups para este site e tente novamente.')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void calculate(false)
  }

  return <>
    {isLoading && <p role="status">Carregando histórico por disciplinas…</p>}
    {error && <div className="form-error" role="alert">{error}</div>}
    {message && <div className="report-save-confirmation" role="status">{message}</div>}
    {history && <form className="report-entry-card" onSubmit={submit}>
      <div className="report-entry-heading"><div><span className="report-step">PESOS DAS DISCIPLINAS</span><h3>{history.contractor} · {month}</h3>
        <p>Sem divisão, mantenha uma única área com 100%. Com divisão, distribua 100% entre até quatro áreas.</p>
      </div></div>
      <fieldset disabled={isBusy} className="ipf-composition-fields">
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
          <strong>Total definido: {totalWeight.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</strong>
        </div>
        {!validWeights && <p role="alert">Os pesos definidos devem somar 100%.</p>}
        <p className="ipf-composition-rule">Área sem média ou com peso 0% não participa. Os pesos das demais são ajustados proporcionalmente para 100%. Uma média válida igual a zero participa normalmente. Todas as notas usam a mesma escala do IDS das avaliações, sem conversão automática para 0–10.</p>
        <div className="ipf-composition-actions">
          <button className="outline-button" type="submit" disabled={!validWeights}>{isBusy ? 'Processando…' : 'Calcular IPF por disciplinas'}</button>
          <button className="primary-button" type="button" disabled={!validWeights || result?.value === null || !result}
            onClick={() => void calculate(true)}><Save size={16} />Salvar IPF por disciplinas</button>
        </div>
      </fieldset>
    </form>}
    {result && <CompositionDetails record={result} saved={resultIsSaved} onPdf={() => exportPdf(result)} />}
    {history && <section className="panel ipf-composition-history">
      <div className="panel-heading"><div><h3>Histórico do IPF por disciplinas · {year}</h3><p>Valores salvos, independentes do IPF manual por formulário. As médias e os pesos históricos não mudam quando novas avaliações são criadas.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Mês</th><th>IPF salvo</th><th>Disciplinas participantes</th><th>Detalhes</th></tr></thead><tbody>
        {history.months.map(record => <tr key={record.month}><td>{String(record.month).padStart(2, '0')}/{year}</td><td>{formatValue(record.value)}</td>
          <td>{record.areas.filter(area => area.status === 'included').map(area => `${area.areaName} (${formatValue(area.effectiveWeight)}%)`).join(' · ')}</td>
          <td><button className="quiet-button" type="button" onClick={() => setViewedMonth(record)}>Ver composição de {String(record.month).padStart(2, '0')}/{year}</button></td></tr>)}
        {!history.months.length && <tr><td colSpan={4}>Nenhum IPF por disciplinas registrado neste ano.</td></tr>}
      </tbody></table></div>
    </section>}
    {viewedMonth && <CompositionDetails record={viewedMonth} saved onPdf={() => exportPdf(viewedMonth)} />}
  </>
}

function CompositionDetails({ record, saved, onPdf }: { record: IpfComposition; saved: boolean; onPdf: () => void }) {
  return <article className="panel ipf-composition-result">
    <div className="panel-heading"><div><h3>{saved ? 'Composição salva' : 'Prévia — ainda não salva'} · {String(record.month).padStart(2, '0')}/{record.year}</h3>
      <p>{record.contractor}{record.updatedAtUtc ? ` · Salvo em ${new Date(record.updatedAtUtc).toLocaleString('pt-BR')}` : ''}</p></div>
      <button className="outline-button" type="button" onClick={onPdf}><FileDown size={16} />PDF da composição</button>
    </div>
    <p className="ipf-composition-score">IPF final: <strong>{formatValue(record.value)}</strong></p>
    {record.areas.some(area => area.status === 'no-average' && area.weight > 0)
      && <p role="status">Há áreas sem média. Elas não participaram da nota; os pesos das áreas com média foram ajustados proporcionalmente.</p>}
    <div className="table-scroll"><table><thead><tr><th>Disciplina</th><th>Média IDS</th><th>Avaliações válidas / total</th><th>Peso definido</th><th>Peso aplicado</th><th>Contribuição</th><th>Situação</th></tr></thead><tbody>
      {record.areas.map(area => <tr key={area.areaId}><td>{area.areaName}</td><td>{formatValue(area.average)}</td>
        <td>{area.scoredEvaluationCount} / {area.evaluationCount}</td><td>{formatValue(area.weight)}%</td><td>{formatValue(area.effectiveWeight)}%</td>
        <td>{area.contribution === null ? '—' : formatValue(area.contribution)}</td>
        <td>{area.status === 'included' ? 'Participou' : area.status === 'zero-weight' ? 'Sem peso' : 'Sem média — excluída'}</td></tr>)}
    </tbody></table></div>
    <p>Fórmula: soma das médias × pesos definidos, dividida pela soma dos pesos das áreas participantes. O cálculo usa as médias sem arredondamento intermediário; o IPF final é arredondado a quatro casas.</p>
  </article>
}
