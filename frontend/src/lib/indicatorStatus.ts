export type IndicatorKind = 'ids' | 'ipf'

export function indicatorStatus(kind: IndicatorKind, value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null
  return value >= (kind === 'ids' ? 0.85 : 7) ? 'Meta alcançada' : 'Não atingiu a meta'
}

export function indicatorColor(kind: IndicatorKind, value: number | null | undefined) {
  const status = indicatorStatus(kind, value)
  return status === null ? null : status === 'Meta alcançada' ? '#18743a' : '#c62828'
}
