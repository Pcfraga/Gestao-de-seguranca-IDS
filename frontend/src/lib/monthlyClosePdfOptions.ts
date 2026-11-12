export type PdfLanguage = 'pt' | 'en'
export type PdfColorKey = 'low' | 'medium' | 'high' | 'categories' | 'items'
export interface MonthlyClosePdfOptions {
  language: PdfLanguage
  colors: Record<PdfColorKey, string>
}

export const pdfOptionsStorageKey = 'ids.monthly-close-pdf-options'
export const defaultPdfOptions: MonthlyClosePdfOptions = {
  language: 'pt',
  colors: { low: '#70a681', medium: '#d2a052', high: '#bd6963', categories: '#4d9d65', items: '#4d9d65' },
}

export function parsePdfOptions(raw: string): MonthlyClosePdfOptions {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || !('language' in parsed) || !('colors' in parsed)
    || (parsed.language !== 'pt' && parsed.language !== 'en')
    || !parsed.colors || typeof parsed.colors !== 'object') {
    throw new Error('Configurações de PDF inválidas.')
  }
  const colors = parsed.colors
  const getColor = (key: string) => {
    const color: unknown = Reflect.get(colors, key)
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Cor de PDF inválida.')
    return color
  }
  return { language: parsed.language, colors: {
    low: getColor('low'), medium: getColor('medium'), high: getColor('high'),
    categories: getColor('categories'), items: getColor('items'),
  } }
}
