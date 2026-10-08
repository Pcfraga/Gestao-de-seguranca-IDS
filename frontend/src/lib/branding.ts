import { apiRequest } from './api'

export interface ReportBranding {
  companyName: string
  tagline: string
  logoDataUrl: string
  primaryColor: string
}

const maxLogoWidth = 480
const maxLogoHeight = 200

export const defaultPrimaryColor = '#173e2e'
export const defaultBranding: ReportBranding = { companyName: '', tagline: '', logoDataUrl: '', primaryColor: defaultPrimaryColor }

let cached: ReportBranding = { ...defaultBranding }

export function loadBranding(): ReportBranding {
  return cached
}

interface ReportSettingsResponse {
  companyName: string
  tagline: string
  logoDataUrl: string | null
  primaryColor: string
}

function fromResponse(value: ReportSettingsResponse): ReportBranding {
  return {
    companyName: value.companyName ?? '',
    tagline: value.tagline ?? '',
    logoDataUrl: value.logoDataUrl ?? '',
    primaryColor: /^#[0-9a-fA-F]{6}$/.test(value.primaryColor) ? value.primaryColor : defaultPrimaryColor,
  }
}

export async function fetchBranding(): Promise<ReportBranding> {
  cached = fromResponse(await apiRequest<ReportSettingsResponse>('/api/settings/report'))
  return cached
}

export async function saveBranding(branding: ReportBranding): Promise<ReportBranding> {
  cached = fromResponse(await apiRequest<ReportSettingsResponse>('/api/settings/report', {
    method: 'PUT',
    body: JSON.stringify({ ...branding, logoDataUrl: branding.logoDataUrl || null }),
  }))
  return cached
}

export function shade(hex: string, amount: number) {
  const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16))
  const mixed = channels.map(channel => Math.round(channel + (255 - channel) * amount))
  return `#${mixed.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
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
