export type DateRange = {
  startDate: string
  endDate: string
}

export const HISTORICAL_DATE_MIN = '2026-01-01'
export const HISTORICAL_DATE_MAX = '2026-01-31'
export const DEFAULT_HISTORICAL_DATE_RANGE: DateRange = {
  startDate: '2026-01-06',
  endDate: '2026-01-12',
}

export type AccuracyMetricsData = {
  mae: number | null
  rmse: number | null
  mapePercent: number | null
  bias: number | null
  count: number
  mapeCount: number
}

export type HistoricalAccuracyRecord = {
  deliveryDate: string
  settlementPeriod: number
  timestamp: string
  forecastMW: number | null
  actualMW: number | null
  forecastErrorMW: number | null
  forecastPublishTime: string | null
  cutoffTime: string
}

export type HistoricalAccuracyResponse = {
  source: string
  forecastDataset: string
  actualDataset: string
  startDate: string
  endDate: string
  matchedCount: number
  metrics: AccuracyMetricsData
  dataAvailability: {
    forecastRecords: number
    actualHalfHourlyPeriods: number
    matchedRecords: number
    forecastMissingPeriods: number
    actualMissingPeriods: number
  }
  data: HistoricalAccuracyRecord[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isHistoricalAccuracyRecord(value: unknown): value is HistoricalAccuracyRecord {
  if (!isRecord(value)) return false
  const isNullableNumber = (field: unknown) => field === null || isFiniteNumber(field)
  return (
    typeof value.deliveryDate === 'string' &&
    typeof value.settlementPeriod === 'number' &&
    typeof value.timestamp === 'string' &&
    isNullableNumber(value.forecastMW) &&
    isNullableNumber(value.actualMW) &&
    isNullableNumber(value.forecastErrorMW) &&
    (value.forecastPublishTime === null || typeof value.forecastPublishTime === 'string') &&
    typeof value.cutoffTime === 'string'
  )
}

export function isHistoricalAccuracyResponse(
  value: unknown,
): value is HistoricalAccuracyResponse {
  if (!isRecord(value) || !isRecord(value.metrics) || !isRecord(value.dataAvailability)) {
    return false
  }

  const { metrics, dataAvailability } = value
  const isNullableNumber = (field: unknown) => field === null || isFiniteNumber(field)
  return (
    typeof value.source === 'string' &&
    typeof value.forecastDataset === 'string' &&
    typeof value.actualDataset === 'string' &&
    typeof value.startDate === 'string' &&
    typeof value.endDate === 'string' &&
    typeof value.matchedCount === 'number' &&
    isNullableNumber(metrics.mae) &&
    isNullableNumber(metrics.rmse) &&
    isNullableNumber(metrics.mapePercent) &&
    isNullableNumber(metrics.bias) &&
    typeof metrics.count === 'number' &&
    typeof metrics.mapeCount === 'number' &&
    typeof dataAvailability.forecastRecords === 'number' &&
    typeof dataAvailability.actualHalfHourlyPeriods === 'number' &&
    typeof dataAvailability.matchedRecords === 'number' &&
    typeof dataAvailability.forecastMissingPeriods === 'number' &&
    typeof dataAvailability.actualMissingPeriods === 'number' &&
    Array.isArray(value.data) &&
    value.data.every(isHistoricalAccuracyRecord)
  )
}

function apiErrorMessage(value: unknown) {
  if (isRecord(value) && typeof value.detail === 'string') return value.detail
  return 'The historical accuracy request failed.'
}

export async function fetchHistoricalAccuracy(
  range: DateRange,
  signal: AbortSignal,
): Promise<HistoricalAccuracyResponse> {
  const params = new URLSearchParams({
    start_date: range.startDate,
    end_date: range.endDate,
  })
  const response = await fetch(
    `http://127.0.0.1:8000/api/analysis/wind/historical-accuracy?${params}`,
    { signal },
  )

  if (!response.ok) {
    const errorBody: unknown = await response.json()
    throw new Error(apiErrorMessage(errorBody))
  }

  const responseBody: unknown = await response.json()
  if (!isHistoricalAccuracyResponse(responseBody)) {
    throw new Error('The backend returned an unexpected historical accuracy response.')
  }

  return responseBody
}
