export interface ReportBranding {
  companyName: string
  tagline: string
  logoDataUrl: string
}

const storageKey = 'ids.report-branding'
const maxLogoWidth = 480
const maxLogoHeight = 200

export const defaultBranding: ReportBranding = { companyName: '', tagline: '', logoDataUrl: '' }

export function loadBranding(): ReportBranding {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<ReportBranding>
    return {
      companyName: typeof stored.companyName === 'string' ? stored.companyName : '',
      tagline: typeof stored.tagline === 'string' ? stored.tagline : '',
      logoDataUrl: typeof stored.logoDataUrl === 'string' && stored.logoDataUrl.startsWith('data:image/') ? stored.logoDataUrl : '',
    }
  } catch {
    return { ...defaultBranding }
  }
}

export function saveBranding(branding: ReportBranding) {
  localStorage.setItem(storageKey, JSON.stringify(branding))
}

export function readLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem (PNG, JPG ou SVG).'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    reader.onload = () => {
      const source = String(reader.result)
      const image = new Image()
      image.onerror = () => reject(new Error('A imagem selecionada não pôde ser carregada.'))
      image.onload = () => {
        const scale = Math.min(1, maxLogoWidth / image.width, maxLogoHeight / image.height)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      }
      image.src = source
    }
    reader.readAsDataURL(file)
  })
}
