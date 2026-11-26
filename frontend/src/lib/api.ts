export interface LoginResponse {
  accessToken: string
  expiresAt: string
  displayName: string
}

export interface EvaluationSummary {
  id: string
  evaluationDate: string
  evaluationTime?: string | null
  status: string
  siteId?: string | null
  islandId?: string | null
  island?: string | null
  clientOrganizationId?: string | null
  contractorOrganizationId?: string | null
  subcontractorOrganizationId?: string | null
  site: string | null
  projectOrIsland?: string | null
  client?: string | null
  contractor: string | null
  leadAuditorName: string | null
  auditorName?: string | null
  areaName?: string
  indicators: {
    observedPeople: number | null
    totalDeviations: number
    ids: number | null
  }
  observations?: Array<{
    category: string
    item: string
    quantity: number | null
    severityWeight: number | null
  }>
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
const tokenStorageKey = 'ids.access-token'

export function getAccessToken() {
  const token = localStorage.getItem(tokenStorageKey)
    ?? sessionStorage.getItem(tokenStorageKey)
  if (token && !localStorage.getItem(tokenStorageKey)) {
    localStorage.setItem(tokenStorageKey, token)
    sessionStorage.removeItem(tokenStorageKey)
  }
  return token
}

export function setAccessToken(token: string) {
  localStorage.setItem(tokenStorageKey, token)
  sessionStorage.removeItem(tokenStorageKey)
}

export function clearAccessToken() {
  localStorage.removeItem(tokenStorageKey)
  sessionStorage.removeItem(tokenStorageKey)
}

export function getAccessTokenOwnerKey() {
  const token = getAccessToken()
  if (!token) return 'anonymous'
  try {
    const encodedPayload = token.split('.')[1]
    const normalizedPayload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/')
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - normalizedPayload.length % 4) % 4),
      '=',
    )
    const payload = JSON.parse(atob(paddedPayload)) as {
      sub?: string
      tenant_id?: string
    }
    if (payload.sub && payload.tenant_id) return `${payload.tenant_id}:${payload.sub}`
  } catch (error) {
    console.warn('Não foi possível identificar a sessão para o cache offline.', error)
  }
  let hash = 2166136261
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `token-${(hash >>> 0).toString(36)}`
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

  const method = (init.method ?? 'GET').toUpperCase()
  const requestUrl = new URL(path, apiBaseUrl || window.location.origin)
  let response: Response
  try {
    response = await fetch(requestUrl, {
      ...init,
      headers,
    })
  } catch {
    if (method === 'GET') {
      const cached = await readCachedGet(requestUrl)
      if (cached) return cached.json() as Promise<T>
    }
    throw new ApiError('Não foi possível conectar à API. Verifique o serviço e tente novamente.', 0)
  }

  if (!response.ok) {
    if (response.status === 401 && token === getAccessToken()) {
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

  if (method === 'GET' && response.ok) {
    await writeCachedGet(requestUrl, response.clone())
  }

  return response.json() as Promise<T>
}

function cacheRequestUrl(requestUrl: URL) {
  const cachedUrl = new URL(requestUrl, window.location.origin)
  cachedUrl.searchParams.set('__ids_cache_owner', getAccessTokenOwnerKey())
  return cachedUrl.toString()
}

async function writeCachedGet(requestUrl: URL, response: Response) {
  if (!('caches' in window)) return
  try {
    const cache = await caches.open('ids-api-offline-v1')
    await cache.put(cacheRequestUrl(requestUrl), response)
  } catch (error) {
    console.warn('Não foi possível atualizar o cache offline.', error)
  }
}

async function readCachedGet(requestUrl: URL) {
  if (!('caches' in window)) return undefined
  try {
    const cache = await caches.open('ids-api-offline-v1')
    return await cache.match(cacheRequestUrl(requestUrl))
  } catch (error) {
    console.warn('Não foi possível ler o cache offline.', error)
    return undefined
  }
}

export interface ChecklistCatalog {
  categories: Array<{
    id: string
    code: string
    name: string
    isCustom: boolean
    items: Array<{ id: string; code: string; name: string; isCustom: boolean }>
  }>
  severities: Array<{ id: string; name: string; weight: number }>
  sites: Array<{ id: string; name: string; projectOrIsland: string | null; isActive: boolean }>
  organizations: Array<{ id: string; name: string; kind: 'Client' | 'Contractor' | 'Subcontractor'; isActive: boolean }>
}

export const defaultInspectionId = '00000000-0000-0000-0000-000000000000'

export interface InspectionArea {
  id: string
  name: string
  isActive: boolean
}

export interface InspectionIsland {
  id: string
  name: string
  isActive: boolean
}

export interface InspectionScope {
  areaId: string
  areaName: string
  formId: string
  formName: string
  islandId?: string
  islandName?: string
  siteId?: string
  contractorId?: string
}

export function inspectionScopeQuery(scope: InspectionScope) {
  const query = new URLSearchParams({ areaId: scope.areaId, formId: scope.formId })
  if (scope.islandId) query.set('islandId', scope.islandId)
  if (scope.siteId) query.set('siteId', scope.siteId)
  if (scope.contractorId) query.set('contractorId', scope.contractorId)
  return query.toString()
}

export interface InspectionFormTemplate {
  id: string
  versionId: string | null
  version: number
  name: string
  isDefault: boolean
  areaId: string
  areaName: string
  categories: Array<{
    id: string
    name: string
    items: Array<{ id: string; name: string }>
  }>
}

export interface EvaluationResult extends EvaluationSummary {
  areaId: string
  areaName: string
  formId: string
  formVersionId: string | null
  formName: string
  formVersion: number
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
  trend: Array<{ evaluationId: string; date: string; ids: number | null; siteId: string | null }>
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
  weekdays: Array<{
    weekNumber: number
    dayOfWeek: number
    evaluationCount: number
    observedPeople: number
    totalDeviations: number
    weightedDeviationTotal: number
    lowSeverityDeviations: number
    mediumSeverityDeviations: number
    highSeverityDeviations: number
    ids: number | null
  }>
  weeklyCategories: Array<{ weekNumber: number; code: string; name: string; quantity: number }>
  weeklyItems: Array<{ weekNumber: number; categoryCode: string; category: string; code: string; name: string; quantity: number }>
  metadata: {
    projectOrIslands: string[]
    sites: string[]
    clients: string[]
    evaluators: string[]
    bySite: Array<{
      siteId: string | null
      projectOrIslands: string[]
      sites: string[]
      clients: string[]
      evaluators: string[]
    }>
  }
  monthlyGroups: Array<{
    contractorId: string | null
    contractor: string | null
    siteId: string | null
    site: string | null
    projectOrIsland: string | null
    evaluationCount: number
    scoredEvaluationCount: number
    observedPeople: number
    totalDeviations: number
    weightedDeviationTotal: number
    lowSeverityDeviations: number
    mediumSeverityDeviations: number
    highSeverityDeviations: number
    idsAverage: number | null
    weeks: Array<{
      weekNumber: number
      idsAverage: number | null
      observedPeople: number
      totalDeviations: number
      weightedDeviationTotal: number
      lowSeverityDeviations: number
      mediumSeverityDeviations: number
      highSeverityDeviations: number
    }>
    weekdays: Array<{
      dayOfWeek: number
      observedPeople: number
      totalDeviations: number
    }>
    categories: Array<{ code: string; name: string; quantity: number }>
    items: Array<{ categoryCode: string; category: string; code: string; name: string; quantity: number }>
  }>
}

export interface IpfAnnualHistory {
  areaId: string | null
  areaName: string
  formId: string | null
  formName: string
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
    idsAverage: number | null
    source: string
    multiplicationFactor: number | null
    additionalScore: number | null
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

export interface IpfCompositionArea {
  areaId: string
  areaName: string
  weight: number
  effectiveWeight: number
  average: number | null
  evaluationCount: number
  scoredEvaluationCount: number
  contribution: number | null
  status: 'included' | 'no-average' | 'zero-weight'
}

export interface IpfComposition {
  id: string | null
  year: number
  month: number
  contractorOrganizationId: string
  contractor: string
  value: number | null
  areas: IpfCompositionArea[]
  updatedAtUtc: string | null
}

export interface IpfCompositionHistory {
  year: number
  contractorOrganizationId: string
  contractor: string
  annualAverage: number | null
  months: IpfComposition[]
}