// Money is rounded to 2 decimals (rupees) and weight to 3 decimals (kg)
// before storing, so totals stay clean in both storage and aggregation.
export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

export function round3(n) {
  return Math.round((Number(n) + Number.EPSILON) * 1000) / 1000
}

export function computeAmount(weightKg, pricePerKg) {
  return round2(round3(weightKg) * round2(pricePerKg))
}
