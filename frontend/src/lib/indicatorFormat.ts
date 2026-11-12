function formatFixed(value: number | null | undefined, digits: number, empty = '—') {
  return value == null ? empty : value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatIds(value: number | null | undefined, empty = '—') {
  return value == null ? empty : `${formatFixed(value * 100, 2)}%`
}

export function formatIdsNumber(value: number | null | undefined, empty = '—') {
  return formatFixed(value, 2, empty)
}

export function formatIpf(value: number | null | undefined, empty = '—') {
  return formatFixed(value, 1, empty)
}
