export type Row = {
  period: string
  time: string
  forecast: number
  actual?: number
  published: string
  version: string
}

const existingRows: Row[] = [
  { period: 'SP 17', time: '08:00', forecast: 8_740, actual: 8_420, published: '05 Jan, 16:02', version: 'Day-ahead' },
  { period: 'SP 18', time: '08:30', forecast: 8_910, actual: 8_680, published: '05 Jan, 16:02', version: 'Day-ahead' },
  { period: 'SP 19', time: '09:00', forecast: 9_120, actual: 8_610, published: '05 Jan, 16:02', version: 'Day-ahead' },
  { period: 'SP 20', time: '09:30', forecast: 9_280, actual: 8_940, published: '05 Jan, 16:02', version: 'Day-ahead' },
  { period: 'SP 21', time: '10:00', forecast: 9_410, actual: 9_170, published: '05 Jan, 16:02', version: 'Day-ahead' },
  { period: 'SP 22', time: '10:30', forecast: 9_560, actual: 9_220, published: '05 Jan, 16:02', version: 'Day-ahead' },
  { period: 'SP 23', time: '11:00', forecast: 9_690, actual: 9_510, published: '05 Jan, 16:02', version: 'Day-ahead' },
  { period: 'SP 24', time: '11:30', forecast: 9_820, actual: 9_460, published: '05 Jan, 16:02', version: 'Day-ahead' },
]

export const futureRows: Row[] = [
  { period: 'SP 17', time: '08:00', forecast: 10_240, published: '14 Jan, 16:04', version: 'Day-ahead' },
  { period: 'SP 18', time: '08:30', forecast: 10_480, published: '14 Jan, 16:04', version: 'Day-ahead' },
  { period: 'SP 19', time: '09:00', forecast: 10_680, published: '14 Jan, 16:04', version: 'Day-ahead' },
]



export const rows: Row[] = Array.from({ length: 48 }, (_, index) => {
  const periodNumber = index + 1
  const period = `SP ${periodNumber}`
  const existing = existingRows.find((row) => row.period === period)

  return existing ?? {
    period,
    time: getPeriodTime(periodNumber),
    forecast: 0,
    published: 'Not loaded',
    version: 'Not loaded',
  }
})

export const matchedRows = rows.filter(
  (row): row is Row & { actual: number } => typeof row.actual === 'number'
)

function getPeriodTime(periodNumber: number): string {
  const totalMinutes = (periodNumber - 1) * 30
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}




export function getAccuracyMetrics() {
  const errors = matchedRows.map((row) => row.forecast - row.actual)
  const mae = errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length
  const rmse = Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length)
  const bias = errors.reduce((sum, error) => sum + error, 0) / errors.length

  return { mae, rmse, bias, count: matchedRows.length }
}
