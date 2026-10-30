import { useId } from 'react'
import { getAccuracyMetrics } from '../../dashboard-data'
import type { AccuracyMetricsData } from '../../api/historicalAccuracy'

type AccuracyMetricsProps = {
  metrics?: AccuracyMetricsData
}

const styles = `
.ui-accuracy-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.ui-accuracy-metrics.live { grid-template-columns: repeat(5, 1fr); }
.ui-metric-card { background: var(--white); border: 1px solid var(--line); border-top: 3px solid var(--green); border-radius: 9px; padding: 12px 15px; }
.ui-metric-card.highlight { border-top-color: var(--fresh); }
.ui-metric-label { color: #676E68; text-transform: uppercase; font-size: 10px; letter-spacing: .45px; font-weight: 700; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.ui-info-wrap { position: relative; display: inline-flex; flex: 0 0 auto; text-transform: none; }
.ui-info-dot { width: 16px; height: 16px; display: grid; place-items: center; padding: 0; border: 1px solid #C8CDC8; border-radius: 50%; background: var(--white); color: #676E68; font: inherit; font-size: 10px; line-height: 1; cursor: help; }
.ui-info-wrap:hover .ui-info-dot, .ui-info-wrap:focus-visible .ui-info-dot { border-color: var(--green); color: var(--green); outline: none; }
.ui-info-tooltip { position: absolute; z-index: 20; top: calc(100% + 7px); right: -8px; width: min(230px, calc(100vw - 48px)); padding: 9px 11px; border: 1px solid #D4E9D9; border-radius: 7px; background: var(--white); box-shadow: 0 4px 14px rgb(24 48 32 / 16%); color: #343934; font-size: 11px; font-weight: 400; line-height: 1.45; letter-spacing: normal; text-transform: none; text-align: left; visibility: hidden; opacity: 0; transform: translateY(-2px); transition: opacity .12s ease, transform .12s ease, visibility .12s; pointer-events: none; }
.ui-info-wrap:hover .ui-info-tooltip, .ui-info-wrap:focus-visible .ui-info-tooltip { visibility: visible; opacity: 1; transform: translateY(0); }
.ui-metric-card strong { font-size: 24px; display: block; margin: 6px 0 3px; }
.ui-metric-card > span { font-size: 11px; color: var(--muted); }
@media (max-width: 1050px) {
  .ui-accuracy-metrics, .ui-accuracy-metrics.live { grid-template-columns: repeat(2, 1fr); }
}
`

function formatMetric(value: number | null) {
  return value === null
    ? '—'
    : new Intl.NumberFormat('en-GB', { maximumFractionDigits: 3 }).format(value)
}

function getDemoMetrics(): AccuracyMetricsData {
  const demoMetrics = getAccuracyMetrics()
  return {
    mae: demoMetrics.mae,
    rmse: demoMetrics.rmse,
    bias: demoMetrics.bias,
    count: demoMetrics.count,
    mapePercent: null,
    mapeCount: 0,
  }
}

function MetricInfo({ label, description }: { label: string; description: string }) {
  const tooltipId = `metric-info-${useId()}`

  return (
    <span
      className="ui-info-wrap"
      tabIndex={0}
      aria-label={`About ${label}`}
      aria-describedby={tooltipId}
      onMouseDown={(event) => event.preventDefault()}
    >
      <span className="ui-info-dot" aria-hidden="true">i</span>
      <span className="ui-info-tooltip" id={tooltipId} role="tooltip">{description}</span>
    </span>
  )
}

export default function AccuracyMetrics({ metrics: historicalMetrics }: AccuracyMetricsProps) {
  const isHistorical = historicalMetrics !== undefined
  const metrics = historicalMetrics ?? getDemoMetrics()

  return (
    <>
      <style>{styles}</style>
      <div className={`ui-accuracy-metrics${isHistorical ? ' live' : ''}`}>
        <article className="ui-metric-card"><div className="ui-metric-label">Mean absolute error<MetricInfo label="Mean Absolute Error (MAE)" description="The average absolute difference between forecast and actual generation, measured in MW." /></div><strong>{isHistorical ? formatMetric(metrics.mae) : Math.round(metrics.mae ?? 0)}{metrics.mae === null ? '' : ' MW'}</strong><span>{metrics.count} {isHistorical ? 'matched half-hour periods' : 'valid matched periods'}</span></article>
        <article className="ui-metric-card highlight"><div className="ui-metric-label">Root mean squared error<MetricInfo label="Root Mean Squared Error (RMSE)" description="Larger forecasting errors have a greater impact on this metric." /></div><strong>{isHistorical ? formatMetric(metrics.rmse) : Math.round(metrics.rmse ?? 0)}{metrics.rmse === null ? '' : ' MW'}</strong><span>Larger errors carry more weight</span></article>
        {isHistorical && <article className="ui-metric-card"><div className="ui-metric-label">MAPE<MetricInfo label="MAPE" description="The average absolute percentage error. Records with actual generation at or below 1 MW are excluded." /></div><strong>{formatMetric(metrics.mapePercent)}{metrics.mapePercent === null ? '' : '%'}</strong><span>{metrics.mapeCount} records; actual &gt; 1 MW</span></article>}
        <article className="ui-metric-card"><div className="ui-metric-label">Mean error / bias<MetricInfo label="Mean Error / Bias" description="The average signed error (Forecast − Actual). Positive means overforecasting; negative means underforecasting." /></div><strong>{isHistorical ? formatMetric(metrics.bias) : `+${Math.round(metrics.bias ?? 0)}`}{metrics.bias === null ? '' : ' MW'}</strong><span>{metrics.bias === null ? 'No matched records' : metrics.bias > 0 ? 'Positive · overforecasting' : metrics.bias < 0 ? 'Negative · underforecasting' : 'No average bias'}</span></article>
        <article className="ui-metric-card"><div className="ui-metric-label">Matched records<MetricInfo label="Matched Records" description="The number of half-hour periods with both valid forecast and actual generation data." /></div><strong>{metrics.count}</strong><span>{isHistorical ? 'Matched half-hour observations' : 'Valid matched periods'}</span></article>
      </div>
    </>
  )
}
