import { useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { HistoricalAccuracyRecord } from '../../api/historicalAccuracy'

type ForecastActualChartProps = {
  records?: HistoricalAccuracyRecord[]
  startDate?: string
  endDate?: string
}

type ChartPoint = {
  record: HistoricalAccuracyRecord
  x: number
  forecastY: number | null
  actualY: number | null
}

const plotTop = 24
const plotBottom = 224
const chartHeight = 300
const leftPadding = 64
const rightPadding = 24

const styles = `
.ui-forecast-chart { padding: 15px 17px; background: var(--white); border: 1px solid var(--line); border-top: 3px solid var(--green); border-radius: 10px; }
.ui-chart-title { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.ui-chart-title h3 { font-size: 15px; color: var(--green); }
.ui-chart-title p { color: var(--muted); font-size: 11px; margin-top: 3px; }
.ui-chart-legend { display: flex; gap: 16px; color: var(--muted); font-size: 13px; font-weight: 600; white-space: nowrap; }
.ui-chart-legend i { display: inline-block; width: 26px; height: 4px; background: #89918B; margin-right: 7px; vertical-align: middle; }
.ui-chart-legend i.green { background: var(--green); }
.ui-chart-legend i.dashed { height: 0; border-top: 4px dashed #89918B; background: transparent; }
.ui-chart-tooltip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 16px; margin: 12px 0; padding: 11px 13px; background: var(--pale); border: 1px solid #D4E9D9; border-radius: 8px; color: #315B3D; font-size: 11px; }
.ui-chart-tooltip div { min-width: 0; }
.ui-chart-tooltip span, .ui-chart-tooltip strong { display: block; }
.ui-chart-tooltip span { margin-bottom: 3px; opacity: .8; }
.ui-chart-tooltip strong { font-size: 12px; overflow-wrap: anywhere; }
.ui-chart-scroll { overflow-x: auto; margin-top: 12px; padding-bottom: 5px; }
.ui-chart-svg { display: block; height: 300px; max-width: none; background-color: #FFFFFF;}
.ui-chart-grid-lines { stroke: #E9ECE9; stroke-width: 1; }
.ui-chart-axis { fill: none; stroke: #9AA19B; stroke-width: 1; }
.ui-chart-forecast-line { stroke: var(--green); stroke-width: 2.4; fill: none; }
.ui-chart-actual-line { stroke: #89918B; stroke-width: 2; fill: none; stroke-dasharray: 6 4; }
.ui-chart-forecast-dot { fill: white; stroke: var(--green); stroke-width: 1.5; }
.ui-chart-actual-dot { fill: #89918B; stroke: white; stroke-width: 1; }
.ui-chart-axis-label, .ui-chart-tick { fill: #717972; font: 11px 'DM Sans', sans-serif; }
.ui-chart-axis-label { font-weight: 600; }
.ui-chart-tick { font-size: 10px; }
.ui-chart-empty { min-height: 190px; display: grid; place-items: center; padding: 20px; color: var(--muted); font-size: 12px; text-align: center; }
@media (max-width: 650px) {
  .ui-chart-title { flex-direction: column; }
  .ui-chart-tooltip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZoneName: 'short',
})

export function formatMW(value: number) {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 3 }).format(value)
}

export function formatSignedMW(value: number | null) {
  if (value === null) return 'Unavailable'
  if (value > 0) return `+${formatMW(value)} MW`
  if (value < 0) return `−${formatMW(Math.abs(value))} MW`
  return '0 MW'
}

function formatLocalTime(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : timeFormatter.format(parsed)
}

function formatDeliveryDate(value: string) {
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed)
}

function formatRange(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return 'Selected historical period'
  return `${formatDeliveryDate(startDate)} – ${formatDeliveryDate(endDate)}`
}

function pathFor(
  points: ChartPoint[],
  valueKey: 'forecastY' | 'actualY',
) {
  let drawing = false
  const commands: string[] = []
  for (const point of points) {
    const y = point[valueKey]
    if (y === null) {
      drawing = false
      continue
    }
    commands.push(`${drawing ? 'L' : 'M'} ${point.x} ${y}`)
    drawing = true
  }
  return commands.join(' ')
}

function formatDateTick(record: HistoricalAccuracyRecord) {
  const date = formatDeliveryDate(record.deliveryDate)
  const time = formatLocalTime(record.timestamp).split(', ').slice(-1)[0]
  return `${date.slice(0, 6)} ${time}`
}

export default function ForecastActualChart({
  records,
  startDate,
  endDate,
}: ForecastActualChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const isHistorical = records !== undefined

  if (!isHistorical) {
    return (
      <>
        <style>{styles}</style>
        <article className="ui-forecast-chart">
          <div className="ui-chart-title"><div><h3>Forecast vs actual generation</h3><p>Illustrative demo data · 6 January · 08:00–12:00 GMT</p></div><div className="ui-chart-legend"><span><i className="green" />Forecast</span><span><i />Actual</span></div></div>
          <div className="ui-chart-scroll">
            <svg className="ui-chart-svg" width="700" viewBox="0 0 700 180" preserveAspectRatio="none" aria-label="Illustrative forecast and actual line chart">
              <g className="ui-chart-grid-lines"><path d="M0 10H700M0 63H700M0 116H700M0 169H700" /></g>
              <path className="ui-chart-actual-line" d="M10 141 L105 127 L200 131 L295 113 L390 101 L485 98 L580 82 L690 86" />
              <path className="ui-chart-forecast-line" d="M10 124 L105 115 L200 103 L295 94 L390 87 L485 79 L580 72 L690 65" />
              <g>{[10, 105, 200, 295, 390, 485, 580, 690].map((x, i) => <circle key={x} className="ui-chart-forecast-dot" cx={x} cy={[124, 115, 103, 94, 87, 79, 72, 65][i]} r="4" />)}</g>
            </svg>
          </div>
        </article>
      </>
    )
  }

  const observations = [...(records ?? [])].sort(
    (first, second) =>
      new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime(),
  )
  const availableValues = observations.flatMap((record) =>
    [record.forecastMW, record.actualMW].filter(
      (value): value is number => value !== null && Number.isFinite(value),
    ),
  )
  const maximumMW = Math.max(1000, ...availableValues)
  const chartMaximum = Math.ceil(maximumMW / 1000) * 1000
  const chartWidth = Math.max(1000, observations.length * 14)
  const plotWidth = chartWidth - leftPadding - rightPadding
  const timestamps = observations.map((record) => new Date(record.timestamp).getTime())
  const firstTimestamp = timestamps[0] ?? 0
  const lastTimestamp = timestamps[timestamps.length - 1] ?? firstTimestamp
  const timeSpan = lastTimestamp - firstTimestamp
  const points: ChartPoint[] = observations.map((record, index) => {
    const x = leftPadding + (
      timeSpan > 0
        ? ((timestamps[index] - firstTimestamp) / timeSpan) * plotWidth
        : plotWidth / 2
    )
    return {
      record,
      x,
      forecastY: record.forecastMW === null
        ? null
        : plotBottom - (record.forecastMW / chartMaximum) * (plotBottom - plotTop),
      actualY: record.actualMW === null
        ? null
        : plotBottom - (record.actualMW / chartMaximum) * (plotBottom - plotTop),
    }
  })
  const forecastPath = pathFor(points, 'forecastY')
  const actualPath = pathFor(points, 'actualY')
  const tickIndexes = Array.from({ length: Math.min(6, observations.length) }, (_, index) =>
    observations.length < 2
      ? 0
      : Math.round((index / (Math.min(6, observations.length) - 1)) * (observations.length - 1)),
  )
  const selectedRecord = hoverIndex === null ? null : observations[hoverIndex] ?? null
  const calculatedError = selectedRecord &&
    selectedRecord.forecastMW !== null &&
    selectedRecord.actualMW !== null
    ? selectedRecord.forecastMW - selectedRecord.actualMW
    : null
  const hasPlottableValues = availableValues.length > 0

  function showPoint(event: MouseEvent<SVGRectElement>, index: number) {
    event.preventDefault()
    setHoverIndex(index)
  }

  function moveKeyboardPoint(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    setHoverIndex((current) => {
      if (current === null) return 0
      const direction = event.key === 'ArrowRight' ? 1 : -1
      return Math.max(0, Math.min(observations.length - 1, current + direction))
    })
  }

  return (
    <>
      <style>{styles}</style>
      <article className="ui-forecast-chart">
        <div className="ui-chart-title">
          <div>
            <h3>Forecast vs actual generation</h3>
            <p>{formatRange(startDate, endDate)} · {observations.length} half-hour settlement periods</p>
          </div>
          <div className="ui-chart-legend">
            <span><i className="green" />Forecast</span>
            <span><i className="dashed" />Actual</span>
          </div>
        </div>

        {selectedRecord && <div className="ui-chart-tooltip" role="status" aria-live="polite">
          <div><span>Delivery date</span><strong>{formatDeliveryDate(selectedRecord.deliveryDate)}</strong></div>
          <div><span>Settlement period</span><strong>SP {selectedRecord.settlementPeriod}</strong></div>
          <div><span>Delivery time</span><strong>{formatLocalTime(selectedRecord.timestamp)} (Europe/London)</strong></div>
          <div><span>Forecast generation</span><strong>{selectedRecord.forecastMW === null ? 'Unavailable' : `${formatMW(selectedRecord.forecastMW)} MW`}</strong></div>
          <div><span>Actual generation</span><strong>{selectedRecord.actualMW === null ? 'Unavailable' : `${formatMW(selectedRecord.actualMW)} MW`}</strong></div>
          <div><span>Forecast error (Forecast − Actual)</span><strong>{formatSignedMW(calculatedError)}</strong></div>
        </div>}

        {observations.length === 0 || !hasPlottableValues ? (
          <div className="ui-chart-empty">No forecast or actual generation observations are available to plot for this date range. Missing values are not interpolated.</div>
        ) : (
          <>
            <div className="ui-chart-scroll" role="region" aria-label="Scrollable half-hourly wind generation chart">
              <svg
                className="ui-chart-svg"
                width={chartWidth}
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="none"
                role="img"
                aria-label="Forecast and actual wind generation by half-hour settlement period"
                tabIndex={0}
                onKeyDown={moveKeyboardPoint}
                onFocus={() => setHoverIndex((current) => current ?? 0)}
                onBlur={() => setHoverIndex(null)}
              >
                  <rect
                  x={leftPadding}
                  y={plotTop}
                  width={plotWidth}
                  height={plotBottom - plotTop}
                  fill="#FFFFFF"
                  stroke="none"
                />
                {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                  const y = plotBottom - fraction * (plotBottom - plotTop)
                  const value = (chartMaximum * fraction).toLocaleString('en-GB')
                  return (
                    <g key={fraction} className="ui-chart-grid-lines">
                      <path d={`M${leftPadding} ${y}H${chartWidth - rightPadding}`} />
                      <text className="ui-chart-tick" x={leftPadding - 8} y={y + 4} textAnchor="end">{value}</text>
                    </g>
                  )
                })}
                <path className="ui-chart-axis" d={`M${leftPadding} ${plotTop}V${plotBottom}H${chartWidth - rightPadding}`} />
                <path className="ui-chart-actual-line" d={actualPath} />
                <path className="ui-chart-forecast-line" d={forecastPath} />
                {points.map((point, index) => {
                  const xStart = index === 0
                    ? leftPadding
                    : (points[index - 1].x + point.x) / 2
                  const xEnd = index === points.length - 1
                    ? chartWidth - rightPadding
                    : (point.x + points[index + 1].x) / 2
                  return (
                    <g key={`${point.record.deliveryDate}-${point.record.settlementPeriod}`}>
                      {point.forecastY !== null && <circle className="ui-chart-forecast-dot" cx={point.x} cy={point.forecastY} r="2.5" />}
                      {point.actualY !== null && <circle className="ui-chart-actual-dot" cx={point.x} cy={point.actualY} r="2.2" />}
                      <rect
                        x={xStart}
                        y={plotTop}
                        width={Math.max(1, xEnd - xStart)}
                        height={plotBottom - plotTop}
                        fill="transparent"
                        onMouseEnter={(event) => showPoint(event, index)}
                        aria-hidden="true"
                      />
                    </g>
                  )
                })}
                {tickIndexes.map((index) => {
                  const point = points[index]
                  return (
                    <text
                      key={`tick-${point.record.deliveryDate}-${point.record.settlementPeriod}`}
                      className="ui-chart-tick"
                      x={point.x}
                      y={plotBottom + 18}
                      textAnchor="middle"
                    >
                      {formatDateTick(point.record)}
                    </text>
                  )
                })}
                <text className="ui-chart-axis-label" x={(leftPadding + chartWidth - rightPadding) / 2} y={chartHeight - 4} textAnchor="middle">Delivery time (Europe/London)</text>
                <text className="ui-chart-axis-label" transform={`translate(14 ${(plotTop + plotBottom) / 2}) rotate(-90)`} textAnchor="middle">Wind generation (MW)</text>
              </svg>
            </div>
            <p className="availability-note">Hover over any half-hour slot or focus the chart and use the arrow keys to inspect its data. Gaps represent missing Elexon values.</p>
          </>
        )}
      </article>
    </>
  )
}
