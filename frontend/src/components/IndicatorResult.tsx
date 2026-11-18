import { formatIds, formatIdsNumber, formatIpf } from '../lib/indicatorFormat'
import { indicatorColor, indicatorStatus, type IndicatorKind } from '../lib/indicatorStatus'

export function IndicatorResult({ kind, value, originalScale = false, empty = '—', statusKind = kind }: {
  kind: IndicatorKind
  value: number | null | undefined
  originalScale?: boolean
  empty?: string
  statusKind?: IndicatorKind
}) {
  const status = indicatorStatus(statusKind, value)
  const formatted = kind === 'ipf' ? formatIpf(value, empty)
    : originalScale ? formatIdsNumber(value, empty) : formatIds(value, empty)
  return <span className="indicator-result" style={{ color: indicatorColor(statusKind, value) ?? undefined }}>
    {formatted}{status && <span className="indicator-result-status"> · {status}</span>}
  </span>
}
