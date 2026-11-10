export function calculateMonthlyIpf(idsAverage: number | null, factor: string, additionalScore: string): number | null {
  if (idsAverage === null || factor.trim() === '' || additionalScore.trim() === '') return null
  const multiplier = Number(factor)
  const addition = Number(additionalScore)
  if (![idsAverage, multiplier, addition].every(Number.isFinite)) return null
  const idsPercentage = idsAverage * 100
  const result = ((idsPercentage * 60 * multiplier / 100) + addition) / 10
  if (!Number.isFinite(result) || Math.abs(result) > 99999999.9999) return null
  return Math.sign(result) * Math.round((Math.abs(result) + Number.EPSILON) * 10000) / 10000
}
