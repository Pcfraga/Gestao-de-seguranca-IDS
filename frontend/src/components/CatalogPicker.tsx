import { useState } from 'react'
import { Check, LoaderCircle, Plus } from 'lucide-react'

export interface CatalogChoice {
  id: string
  label: string
}

interface CatalogPickerProps {
  label: string
  placeholder: string
  value: string
  options: CatalogChoice[]
  onChange: (value: string) => void
  createTitle: string
  createSecondaryLabel?: string
  onCreate: (name: string, secondaryValue: string) => Promise<CatalogChoice>
}

export function CatalogPicker({
  label,
  placeholder,
  value,
  options,
  onChange,
  createTitle,
  createSecondaryLabel,
  onCreate,
}: CatalogPickerProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [name, setName] = useState('')
  const [secondaryValue, setSecondaryValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function saveNewOption() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Informe um nome.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      const created = await onCreate(trimmedName, secondaryValue.trim())
      onChange(created.id)
      setName('')
      setSecondaryValue('')
      setIsCreating(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível cadastrar este item.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="catalog-picker">
      <label>{label}<span className="catalog-select-row"><select onChange={(event) => onChange(event.target.value)} value={value}><option value="">{placeholder}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><button className="catalog-add-button" type="button" aria-label={createTitle} title={createTitle} onClick={() => { setError(''); setIsCreating((current) => !current) }}><Plus size={15} /></button></span></label>
      {isCreating && <div className="catalog-create-inline"><input autoFocus aria-label={`Nome: ${createTitle}`} maxLength={200} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void saveNewOption() } }} placeholder="Nome" value={name} />{createSecondaryLabel && <input aria-label={createSecondaryLabel} maxLength={200} onChange={(event) => setSecondaryValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void saveNewOption() } }} placeholder={createSecondaryLabel} value={secondaryValue} />}<button className="catalog-save-button" type="button" aria-label={`Salvar ${createTitle}`} disabled={isSaving} onClick={() => void saveNewOption()}>{isSaving ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}</button></div>}
      {error && <span className="catalog-create-error" role="alert">{error}</span>}
    </div>
  )
}