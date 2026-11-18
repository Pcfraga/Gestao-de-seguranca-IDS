import { apiRequest, getAccessTokenOwnerKey, ApiError, type EvaluationResult } from './api'

export interface EvaluationWriteRequest {
  formVersionId: string | null
  evaluationDate: string
  evaluationTime: string | null
  siteId: string | null
  islandId: string | null
  clientOrganizationId: string | null
  contractorOrganizationId: string | null
  subcontractorOrganizationId: string | null
  leadAuditorName: string | null
  auditorName: string | null
  companionName: string | null
  observedPeople: number | null
  strengths: string | null
  improvementOpportunities: string | null
  observations: Array<{
    checklistItemId: string
    quantity: number | null
    severityLevelId: string | null
    comment: string | null
  }>
}

export interface OfflineEvaluationOperation {
  operationId: string
  ownerKey: string
  evaluationId: string | null
  request: EvaluationWriteRequest
  submit: boolean
  createdAt: string
  attempts: number
  lastError: string | null
}

const databaseName = 'ids-offline'
const queueStoreName = 'evaluation-queue'
let databasePromise: Promise<IDBDatabase> | null = null
let syncPromise: Promise<number> | null = null

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(queueStoreName)) {
          database.createObjectStore(queueStoreName, { keyPath: 'operationId' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o armazenamento local.'))
    })
  }
  return databasePromise
}

function transactionResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Falha ao acessar o armazenamento local.'))
  })
}

async function allOperations() {
  const database = await openDatabase()
  return transactionResult(
    database.transaction(queueStoreName, 'readonly').objectStore(queueStoreName).getAll(),
  ) as Promise<OfflineEvaluationOperation[]>
}

async function saveOperation(operation: OfflineEvaluationOperation) {
  const database = await openDatabase()
  await transactionResult(
    database.transaction(queueStoreName, 'readwrite').objectStore(queueStoreName).put(operation),
  )
  notifyQueueChanged()
}

async function removeOperation(operationId: string) {
  const database = await openDatabase()
  await transactionResult(
    database.transaction(queueStoreName, 'readwrite').objectStore(queueStoreName).delete(operationId),
  )
  notifyQueueChanged()
}

function notifyQueueChanged() {
  window.dispatchEvent(new Event('ids:offline-queue-changed'))
}

export async function countPendingEvaluations() {
  const ownerKey = getAccessTokenOwnerKey()
  return (await allOperations()).filter(operation => operation.ownerKey === ownerKey).length
}

export async function queueEvaluation(
  operationId: string,
  request: EvaluationWriteRequest,
  submit: boolean,
  evaluationId: string | null,
) {
  await saveOperation({
    operationId,
    ownerKey: getAccessTokenOwnerKey(),
    evaluationId,
    request,
    submit,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  })
}

export function syncPendingEvaluations() {
  if (!syncPromise) {
    syncPromise = runPendingSynchronization().finally(() => {
      syncPromise = null
    })
  }
  return syncPromise
}

async function runPendingSynchronization() {
  if (!navigator.onLine) return countPendingEvaluations()

  const ownerKey = getAccessTokenOwnerKey()
  const operations = (await allOperations())
    .filter(operation => operation.ownerKey === ownerKey)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))

  for (const operation of operations) {
    try {
      const evaluation = await apiRequest<EvaluationResult>(
        operation.evaluationId ? `/api/evaluations/${operation.evaluationId}` : '/api/evaluations',
        {
          method: operation.evaluationId ? 'PUT' : 'POST',
          body: JSON.stringify(operation.request),
        },
      )

      if (!operation.evaluationId) {
        await saveOperation({ ...operation, evaluationId: evaluation.id, lastError: null })
      }

      if (operation.submit && evaluation.status !== 'Submitted') {
        try {
          await apiRequest<EvaluationResult>(`/api/evaluations/${evaluation.id}/submit`, { method: 'POST' })
        } catch (error) {
          if (error instanceof ApiError && error.status === 400) {
            const current = await apiRequest<EvaluationResult>(`/api/evaluations/${evaluation.id}`)
            if (current.status !== 'Submitted') throw error
          } else {
            throw error
          }
        }
      }

      await removeOperation(operation.operationId)
    } catch (error) {
      if (error instanceof ApiError && error.status === 400 && operation.evaluationId) {
        const current = await apiRequest<EvaluationResult>(`/api/evaluations/${operation.evaluationId}`)
          .catch(() => null)
        if (operation.submit && current?.status === 'Submitted') {
          await removeOperation(operation.operationId)
          continue
        }
      }
      const message = error instanceof Error ? error.message : 'Não foi possível sincronizar esta avaliação.'
      await saveOperation({ ...operation, attempts: operation.attempts + 1, lastError: message })
      if (error instanceof ApiError && (error.status === 0 || error.status === 401)) break
    }
  }

  window.dispatchEvent(new Event('ids:offline-sync-finished'))
  return countPendingEvaluations()
}
