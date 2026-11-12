export function formatPercent(value: number | null) {
  return value === null ? '—' : `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

export function severityWithPercentages<T extends { name: string; quantity: number }>(items: T[]) {
  const total = items.reduce((sum, item) => sum + item.quantity, 0)
  return items.map(item => ({
    ...item,
    percentageLabel: formatPercent(total > 0 ? item.quantity / total : null),
  }))
}
