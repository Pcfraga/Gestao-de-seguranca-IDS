export interface LoginResponse {
  accessToken: string
  expiresAt: string
  displayName: string
}

export interface EvaluationSummary {
  id: string
  evaluationDate: string
  status: string
  siteId?: string | null
  clientOrganizationId?: string | null
  contractorOrganizationId?: string | null
  subcontractorOrganizationId?: string | null
  site: string | null
  contractor: string | null
  leadAuditorName: string | null
  indicators: {
    observedPeople: number | null
    totalDeviations: number
    ids: number | null
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
const tokenStorageKey = 'ids.access-token'

export function getAccessToken() {
  return sessionStorage.getItem(tokenStorageKey)
}

export function setAccessToken(token: string) {
  sessionStorage.setItem(tokenStorageKey, token)
}

export function clearAccessToken() {
  sessionStorage.removeItem(tokenStorageKey)
}

export class ApiError extends Error {
  readonly status: number

  constructor(
    message: string,
    status: number,
  ) {
    super(message)
    this.status = status
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(new URL(path, apiBaseUrl || window.location.origin), {
      ...init,
      headers,
    })
  } catch {
    throw new ApiError('Não foi possível conectar à API. Verifique o serviço e tente novamente.', 0)
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAccessToken()
      window.dispatchEvent(new Event('ids:unauthorized'))
    }
    const payload = await response.json().catch(() => null) as {
      message?: string
      title?: string
      detail?: string
      errors?: string[] | Record<string, string[]>
    } | null
    const validationErrors = Array.isArray(payload?.errors)
      ? payload.errors
      : Object.values(payload?.errors ?? {}).flat()
    const message = response.status === 401
      ? 'Credenciais inválidas ou sessão expirada.'
      : validationErrors.length > 0
        ? validationErrors.join(' ')
        : payload?.message ?? payload?.detail ?? payload?.title ?? `Falha ao comunicar com a API (${response.status}).`
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export interface ChecklistCatalog {
  categories: Array<{
    id: string
    code: string
    name: string
    items: Array<{ id: string; code: string; name: string }>
  }>
  severities: Array<{ id: string; name: string; weight: number }>
  sites: Array<{ id: string; name: string; projectOrIsland: string | null }>
  organizations: Array<{ id: string; name: string; kind: 'Client' | 'Contractor' | 'Subcontractor' }>
}

export interface EvaluationResult extends EvaluationSummary {
  evaluationTime: string | null
  projectOrIsland: string | null
  client: string | null
  subcontractor: string | null
  leadAuditorName: string | null
  auditorName: string | null
  companionName: string | null
  strengths: string | null
  improvementOpportunities: string | null
  observations: Array<{
    checklistItemId: string
    category: string
    item: string
    quantity: number | null
    severityWeight: number | null
    comment: string | null
    hasIncompletePair: boolean
  }>
  indicators: {
    observedPeople: number | null
    totalDeviations: number
    weightedDeviationTotal: number
    ids: number | null
    lowSeverityShare: number | null
    mediumSeverityShare: number | null
    highSeverityShare: number | null
  }
}

export interface DashboardSummary {
  evaluationCount: number
  observedPeopleTotal: number | null
  totalDeviations: number
  lowSeverityDeviations: number
  mediumSeverityDeviations: number
  highSeverityDeviations: number
  lowSeverityShare: number | null
  mediumSeverityShare: number | null
  highSeverityShare: number | null
  ids: number | null
  idsStatus: string
  trend: Array<{ evaluationId: string; date: string; ids: number | null }>
}

export interface DataConsolidation {
  from: string | null
  to: string | null
  evaluationCount: number
  observedPeople: number
  totalDeviations: number
  weightedDeviationTotal: number
  lowSeverityDeviations: number
  mediumSeverityDeviations: number
  highSeverityDeviations: number
  days: Array<{
    date: string
    evaluationCount: number
    observedPeople: number
    totalDeviations: number
    weightedDeviationTotal: number
    lowSeverityDeviations: number
    mediumSeverityDeviations: number
    highSeverityDeviations: number
  }>
  categories: Array<{ code: string; name: string; quantity: number }>
  items: Array<{ categoryCode: string; category: string; code: string; name: string; quantity: number }>
  weekGroupingStatus: string
}

export interface IpfAnnualHistory {
  year: number
  contractorOrganizationId: string
  contractor: string
  annualAverage: number | null
  months: Array<{
    id: string
    year: number
    month: number
    contractorOrganizationId: string
    contractor: string
    siteId: string | null
    site: string | null
    value: number
    source: string
    updatedAtUtc: string
  }>
}

export interface IpfMonthlySuggestion {
  year: number
  month: number
  contractorOrganizationId: string
  average: number | null
  evaluationCount: number
  scoredEvaluationCount: number
}