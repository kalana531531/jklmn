import type { HistoricalAccuracyRecord } from '../../api/historicalAccuracy'

type LargestErrorsTableProps = {
  range: string
  records: HistoricalAccuracyRecord[]
  onOpenErrorAnalysis?: () => void
}

const styles = `
.ui-largest-errors { margin-top: 14px; padding: 15px 17px 5px; background: var(--white); border: 1px solid var(--line); border-top: 3px solid var(--green); border-radius: 10px; overflow: hidden; }
.ui-errors-title { display: flex; justify-content: space-between; align-items: flex-start; }
.ui-errors-title h3 { font-size: 15px; color: var(--green); }
.ui-errors-title p { color: var(--muted); font-size: 11px; margin-top: 3px; }
.ui-error-table-wrap { overflow-x: auto; }
.ui-error-table { border-collapse: collapse; width: 100%; margin-top: 11px; font-size: 11px; white-space: nowrap; }
.ui-error-table th { text-align: left; color: var(--green); text-transform: uppercase; letter-spacing: .4px; font-size: 9px; background: var(--pale); padding: 8px 10px; }
.ui-error-table td { border-bottom: 1px solid #EBEEEB; padding: 9px 10px; }
.ui-error-table td.positive { color: #A55E19; font-weight: 600; }
.ui-error-table td.negative { color: #35679A; font-weight: 600; }
.ui-error-table tbody b { color: var(--green); }
.ui-errors-link { border: 0; background: transparent; color: var(--green); font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 4px; }
.ui-errors-link .icon { width: 11px; }
.ui-errors-empty { padding: 20px 10px; color: var(--muted); text-align: center; }
`

const deliveryTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const publicationTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZoneName: 'short',
})

type MatchedAccuracyRecord = HistoricalAccuracyRecord & {
  forecastMW: number
  actualMW: number
  forecastErrorMW: number
}

function isMatchedRecord(record: HistoricalAccuracyRecord): record is MatchedAccuracyRecord {
  return (
    record.forecastMW !== null &&
    record.actualMW !== null &&
    record.forecastErrorMW !== null
  )
}

function formatMW(value: number) {
  return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 3 }).format(value)} MW`
}

function formatSignedMW(value: number) {
  if (value > 0) return `+${formatMW(value)}`
  if (value < 0) return `−${formatMW(Math.abs(value))}`
  return formatMW(0)
}

function formatDateTime(value: string, formatter: Intl.DateTimeFormat) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : formatter.format(date)
}

export default function LargestErrorsTable({
  range,
  records,
  onOpenErrorAnalysis,
}: LargestErrorsTableProps) {
  const largestErrors = records
    .filter(isMatchedRecord)
    .sort((first, second) =>
      Math.abs(second.forecastErrorMW) - Math.abs(first.forecastErrorMW) ||
      first.timestamp.localeCompare(second.timestamp),
    )

  return (
    <>
      <style>{styles}</style>
      <article className="ui-largest-errors">
        <div className="ui-errors-title">
          <div><h3>Largest absolute errors</h3><p>{range} · {largestErrors.length} matched records, sorted largest first</p></div>
          {onOpenErrorAnalysis && <button className="ui-errors-link" onClick={onOpenErrorAnalysis}>Open error analysis <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m9 18 6-6-6-6" /></svg></button>}
        </div>
        <div className="ui-error-table-wrap"><table className="ui-error-table"><thead><tr><th>Delivery date/time</th><th>Settlement period</th><th>Forecast</th><th>Actual</th><th>Signed error</th><th>Absolute error</th><th>Forecast published</th></tr></thead>
          <tbody>{largestErrors.length === 0
            ? <tr><td className="ui-errors-empty" colSpan={7}>No matched forecast and actual records are available for this date range.</td></tr>
            : largestErrors.map((record) => {
              const error = record.forecastErrorMW
              return (
                <tr key={`${record.deliveryDate}-${record.settlementPeriod}`}>
                  <td>{formatDateTime(record.timestamp, deliveryTimeFormatter)}</td>
                  <td>{record.settlementPeriod}</td>
                  <td>{formatMW(record.forecastMW)}</td>
                  <td>{formatMW(record.actualMW)}</td>
                  <td className={error > 0 ? 'positive' : error < 0 ? 'negative' : undefined}>{formatSignedMW(error)}</td>
                  <td><b>{formatMW(Math.abs(error))}</b></td>
                  <td>{record.forecastPublishTime
                    ? formatDateTime(record.forecastPublishTime, publicationTimeFormatter)
                    : 'Unavailable'}</td>
                </tr>
              )
            })}</tbody>
        </table></div>
      </article>
    </>
  )
}
