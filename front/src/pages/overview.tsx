import { useEffect, useRef, useState } from 'react'
import { useWindSightAppState, type OverviewPageState, type WindAnalysis } from '../app-state'
import { rows } from '../dashboard-data'

function isWindAnalysis(value: unknown): value is WindAnalysis {
  if (typeof value !== 'object' || value === null) return false

  const result = value as Record<string, unknown>
  const isNullableNumber = (field: unknown) =>
    field === null || (typeof field === 'number' && Number.isFinite(field))

  return (
    typeof result.source === 'string' &&
    typeof result.forecastDataset === 'string' &&
    typeof result.actualDataset === 'string' &&
    typeof result.deliveryDate === 'string' &&
    typeof result.requestedSettlementPeriod === 'number' &&
    typeof result.forecastSettlementPeriod === 'number' &&
    typeof result.cutoffLocal === 'string' &&
    typeof result.cutoffUTC === 'string' &&
    (result.forecastPublishTime === null ||
      typeof result.forecastPublishTime === 'string') &&
    Array.isArray(result.forecastVersions) &&
    result.forecastVersions.every((version: unknown) =>
      typeof version === 'object' &&
      version !== null &&
      'publishTime' in version &&
      typeof version.publishTime === 'string' &&
      'forecastMW' in version &&
      typeof version.forecastMW === 'number' &&
      Number.isFinite(version.forecastMW),
    ) &&
    isNullableNumber(result.forecastMW) &&
    isNullableNumber(result.actualMW) &&
    isNullableNumber(result.forecastErrorMW) &&
    isNullableNumber(result.absoluteErrorMW) &&
    typeof result.forecastAvailable === 'boolean' &&
    typeof result.actualAvailable === 'boolean'
  )
}

async function requestWindAnalysis(params: URLSearchParams): Promise<WindAnalysis> {
  const response = await fetch(
    `/api/analysis/wind/decision?${params}`,
  )

  if (!response.ok) {
    const errorData: unknown = await response.json()
    const detail =
      typeof errorData === 'object' &&
      errorData !== null &&
      'detail' in errorData &&
      typeof errorData.detail === 'string'
        ? errorData.detail
        : 'Failed to retrieve wind analysis.'

    throw new Error(detail)
  }

  const result: unknown = await response.json()
  if (!isWindAnalysis(result)) {
    throw new Error(
      'The wind analysis response did not match the expected format.',
    )
  }
  return result
}

function formatMW(value: number | null) {
  return value === null
    ? 'Unavailable'
    : new Intl.NumberFormat('en-GB', { maximumFractionDigits: 3 }).format(value)
}

function formatPublicationTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).format(parsed)
  return `${date} · ${time}`
}

const styles = `
.overview-page .filter-bar { position: relative; display: grid; grid-template-columns: 1.05fr 1fr 1fr 120px; gap: 12px; align-items: end; padding: 18px; margin: 16px 0 24px; background: var(--white); border: 1px solid var(--line); border-left: 4px solid var(--green); border-radius: 10px; }
.overview-page label > span { display: block; font-size: 11px; font-weight: 700; margin-bottom: 6px; color: var(--green); text-transform: uppercase; letter-spacing: .5px; }
.overview-page input, .overview-page select { width: 100%; height: 37px; border: 1px solid #D9DED9; border-radius: 7px; background: var(--white); color: #343934; padding: 0 10px; outline: none; font-size: 13px; }
.overview-page input:focus, .overview-page select:focus { border-color: var(--green); box-shadow: 0 0 0 2px var(--pale); }
.overview-page .input-wrap { position: relative; }
.overview-page .input-wrap .icon { position: absolute; left: 10px; top: 10px; width: 15px; color: var(--green); pointer-events: none; }
.overview-page .input-wrap input { padding-left: 34px; }
.overview-page .primary { height: 37px; border: 0; border-radius: 7px; background: var(--green); color: white; font-size: 13px; font-weight: 700; }
.overview-page .primary:hover { filter: brightness(.94); }
.overview-page .toast { position: absolute; right: 18px; bottom: -34px; z-index: 3; background: var(--ink); color: white; padding: 7px 10px; border-radius: 6px; font-size: 12px; }
.overview-page .section-heading { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; }
.overview-page .section-heading h2 { font-size: 18px; letter-spacing: -.2px; color: var(--green); }
.overview-page .section-heading p { font-size: 12px; color: var(--muted); margin-top: 4px; }
.overview-page .valid-pill { font-size: 11px; color: var(--green); background: var(--pale); padding: 5px 8px; border-radius: 20px; font-weight: 600; }
.overview-page .summary-grid { display: grid; grid-template-columns: 1.35fr 1fr; gap: 14px; }
.overview-page .forecast-card, .overview-page .versions-card, .overview-page .upcoming-card { background: var(--white); border: 1px solid var(--line); border-top: 3px solid var(--green); border-radius: 10px; overflow: hidden; }
.overview-page .forecast-card { border-top-color: var(--green); }
.overview-page .eyebrow { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 0; color: var(--green); font-size: 10px; letter-spacing: 1px; font-weight: 700; }
.overview-page .comparison-body { display: grid; grid-template-columns: 1fr 190px; gap: 20px; padding: 13px 18px 16px; }
.overview-page .comparison-data h3 { font-size: 14px; margin-bottom: 12px; }
.overview-page .value-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.overview-page .value-pair > div { background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
.overview-page .value-pair span, .overview-page .error-measures span { display: block; color: var(--muted); font-size: 10px; margin-bottom: 4px; }
.overview-page .value-pair strong { color: var(--green); font-size: 23px; }
.overview-page .value-pair strong small { font-size: 11px; color: var(--muted); }
.overview-page .error-measures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 9px; }
.overview-page .error-measures > div { border-left: 3px solid var(--green); background: var(--pale); border-radius: 5px; padding: 7px 9px; }
.overview-page .error-measures b { font-size: 12px; }
.overview-page .data-unavailable { color: var(--muted); font-size: 11px; line-height: 1.45; }
.overview-page .forecast-indicator { display: flex; align-items: center; gap: 9px; margin-top: 10px; border-radius: 7px; padding: 8px 10px; background: var(--pale); color: var(--green); }
.overview-page .indicator-arrow { display: grid; place-items: center; width: 27px; height: 27px; border-radius: 50%; background: var(--green); color: var(--white); font-weight: 700; }
.overview-page .forecast-indicator b, .overview-page .forecast-indicator small { display: block; }
.overview-page .forecast-indicator b { font-size: 11px; }
.overview-page .forecast-indicator small { color: #53715B; font-size: 9px; margin-top: 1px; }
.overview-page .comparison-visual { display: grid; grid-template-rows: 180px 112px; gap: 12px; }
.overview-page .bar-chart { display: flex; align-items: flex-end; justify-content: center; gap: 22px; height: 112px; padding-top: 15px; border-bottom: 1px solid var(--line); background: repeating-linear-gradient(to bottom, var(--white) 0, var(--white) 31px, var(--line) 32px); }
.overview-page .bar-column { width: 52px; height: 96px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; position: relative; }
.overview-page .bar { width: 34px; min-height: 8px; border-radius: 4px 4px 0 0; transition: height .3s ease; }
.overview-page .forecast-bar { background: var(--green); }
.overview-page .actual-bar { background: var(--fresh); }
.overview-page .bar-column b { position: absolute; top: -13px; font-size: 9px; color: var(--ink); }
.overview-page .bar-column span { position: absolute; bottom: -16px; font-size: 9px; color: var(--muted); }
.overview-page .comparison-visual .turbine-scene { min-height: 180px; }
.overview-page .comparison-visual .turbine { transform: scale(1.25) rotateY(-18deg); transform-origin: bottom center; left: calc(50% - 3px); bottom: 12px; }
.overview-page .comparison-visual .hill { bottom: -45px; }
.overview-page .forecast-card footer { background: var(--bg); padding: 11px 18px; display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--line); }
.overview-page .forecast-card footer div { padding-left: 14px; border-left: 1px solid var(--line); }
.overview-page .forecast-card footer div:first-child { padding-left: 0; border: 0; }
.overview-page .forecast-card footer span, .overview-page .forecast-card footer b { display: block; font-size: 11px; }
.overview-page .forecast-card footer span { color: var(--muted); margin-bottom: 4px; }
.overview-page .forecast-card footer b { color: var(--green); }
.overview-page .versions-card { padding: 15px 17px 12px; }
.overview-page .card-title { display: flex; justify-content: space-between; align-items: flex-start; }
.overview-page .card-title h3 { font-size: 15px; color: var(--green); }
.overview-page .card-title p { color: var(--muted); font-size: 11px; margin-top: 3px; }
.overview-page .card-title > span { color: var(--muted); font-size: 11px; background: var(--bg); padding: 4px 7px; border-radius: 5px; }
.overview-page .version { width: 100%; display: grid; grid-template-columns: 15px 1fr auto; align-items: center; gap: 8px; padding: 10px; border: 0; border-bottom: 1px solid #EDF0ED; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.overview-page .version:hover { background: var(--pale); }
.overview-page .version:focus-visible { outline: 2px solid var(--green); outline-offset: -2px; }
.overview-page .versions-list { max-height: 360px; overflow-y: auto; margin-top: 9px; }
.overview-page .version.selected { margin-top: 0; background: var(--pale); border: 1px solid #BEE4C9; border-radius: 7px; }
.overview-page .version b, .overview-page .version small { display: block; }
.overview-page .version small { margin-top: 2px; color: var(--muted); font-size: 10px; }
.overview-page .version em { font-style: normal; font-size: 10px; color: var(--green); }
.overview-page .version.excluded { opacity: .55; }
.overview-page .radio { width: 10px; height: 10px; border-radius: 50%; border: 1px solid #A7AEA7; }
.overview-page .selected .radio { border: 3px solid var(--green); }
.overview-page .rule-note { display: flex; gap: 6px; align-items: center; margin-top: 9px; color: #687069; font-size: 10px; }
.overview-page .rule-note .icon { width: 13px; color: var(--green); }
.overview-page .accuracy-head { margin-top: 25px; }
.overview-page .accuracy-head select { width: 160px; height: 31px; }
.overview-page .analysis-grid { display: grid; grid-template-columns: 1.7fr .8fr; gap: 14px; margin-top: 14px; }
.overview-page .upcoming-card { padding: 15px 17px; }
.overview-page .upcoming-tag { display: inline-block; color: var(--green); background: var(--pale); font-size: 9px; font-weight: 700; letter-spacing: .7px; padding: 3px 5px; border-radius: 3px; margin-bottom: 6px; }
.overview-page .upcoming-row { display: grid; grid-template-columns: .7fr 1fr 1.1fr; align-items: center; padding: 11px 0; border-bottom: 1px solid var(--line); }
.overview-page .upcoming-row b, .overview-page .upcoming-row small { display: block; }
.overview-page .upcoming-row b { font-size: 12px; }
.overview-page .upcoming-row div small { color: var(--muted); font-size: 10px; }
.overview-page .upcoming-row strong { font-size: 14px; color: var(--green); }
.overview-page .upcoming-row strong small { display: inline; font-size: 10px; color: var(--muted); }
.overview-page .upcoming-row > span { font-size: 10px; color: var(--muted); text-align: right; }
.overview-page .turbine-scene { align-self: stretch; min-height: 110px; position: relative; overflow: hidden; perspective: 300px; background: linear-gradient(180deg, #F2FBF5 0%, #E5F4E9 72%); border-radius: 8px; }
.overview-page .hill { position: absolute; width: 170px; height: 75px; border-radius: 50%; bottom: -50px; }
.overview-page .hill-back { background: #A8E4BA; left: 30px; }
.overview-page .hill-front { background: var(--fresh); left: -50px; bottom: -54px; }
.overview-page .turbine { position: absolute; left: 76px; bottom: 20px; transform: rotateY(-12deg); }
.overview-page .tower { width: 7px; height: 67px; background: linear-gradient(90deg, #D4E4D8, white 45%, #AFC7B6); clip-path: polygon(35% 0, 65% 0, 100% 100%, 0 100%); }
.overview-page .rotor { position: absolute; left: 3px; top: 0; width: 5px; height: 5px; animation: spin 6s linear infinite; }
.overview-page .hub { position: absolute; width: 9px; height: 9px; border-radius: 50%; background: var(--green); left: -4px; top: -4px; z-index: 2; }
.overview-page .blade { width: 5px; height: 45px; position: absolute; left: -2px; bottom: 1px; background: linear-gradient(90deg, white, #DCEDE1); border-radius: 80% 15% 15% 15%; transform-origin: 50% 100%; box-shadow: 0 1px 2px #98B7A0; }
.overview-page .blade-b { transform: rotate(120deg); }
.overview-page .blade-c { transform: rotate(240deg); }
.overview-page .cloud { position: absolute; height: 7px; width: 25px; border-radius: 10px; background: white; opacity: .85; }
.overview-page .cloud-one { top: 18px; left: 16px; animation: drift 8s ease-in-out infinite alternate; }
.overview-page .cloud-two { top: 34px; right: 12px; width: 17px; animation: drift 10s ease-in-out infinite alternate-reverse; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes drift { to { transform: translateX(12px); } }
@media (max-width: 1050px) {
  .overview-page .summary-grid, .overview-page .analysis-grid { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .overview-page .filter-bar { grid-template-columns: 1fr 1fr; }
  .overview-page .comparison-body { grid-template-columns: 1fr; }
  .overview-page .comparison-visual { grid-template-columns: 1fr; grid-template-rows: 180px 120px; }
  .overview-page .comparison-visual .turbine-scene { min-height: 180px; }
  .overview-page .error-measures { grid-template-columns: 1fr; }
  .overview-page .forecast-card footer { grid-template-columns: 1fr; gap: 8px; }
  .overview-page .forecast-card footer div { padding: 0; border: 0; }
}
`

function Icon({ name }: { name: 'calendar' | 'info' }) {
  const paths = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  }

  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{paths[name]}</svg>
}

function Turbine() {
  return (
    <div className="turbine-scene" aria-label="Animated wind turbine">
      <div className="cloud cloud-one" />
      <div className="cloud cloud-two" />
      <div className="turbine">
        <div className="tower" />
        <div className="rotor">
          <span className="blade blade-a" /><span className="blade blade-b" /><span className="blade blade-c" />
          <span className="hub" />
        </div>
      </div>
      <div className="hill hill-back" /><div className="hill hill-front" />
    </div>
  )
}

export default function Overview() {
  const { overview, setOverview } = useWindSightAppState()
  const {
    period,
    notice,
    deliveryDate,
    analysisSelection,
    publicationSelection,
    selectedPublication,
    loading,
    apiError,
  } = overview
  const updateOverview = (patch: Partial<OverviewPageState>) =>
    setOverview((state) => ({ ...state, ...patch }))
  const cutoff = '16:30 day-ahead'
  const [refreshVersion, setRefreshVersion] = useState(0)
  const requestSequence = useRef(0)
  const selectionKey = `${deliveryDate}|${period}|${cutoff}`
  const analysisKey = `${selectionKey}|${selectedPublication ?? ''}`
  const analysis = analysisSelection?.key === analysisKey
    ? analysisSelection.data
    : null
  const publicationOptions = publicationSelection?.key === selectionKey
    ? [...publicationSelection.versions].sort(
        (first, second) =>
          new Date(second.publishTime).getTime() -
          new Date(first.publishTime).getTime(),
      )
    : []

  useEffect(() => {
    let active = true
    const requestId = ++requestSequence.current
    updateOverview({
      loading: true,
      apiError: '',
      notice: '',
      publicationSelection: null,
      selectedPublication: null,
    })

    async function updateView() {
      try {
        const settlementPeriod = Number(period.match(/^SP\s+(\d+)/)?.[1])
        if (!settlementPeriod) {
          throw new Error('Please select a valid settlement period.')
        }

        const params = new URLSearchParams({
          delivery_date: deliveryDate,
          settlement_period: String(settlementPeriod),
          cutoff_time: '16:30',
        })
        const result = await requestWindAnalysis(params)
        if (!active || requestId !== requestSequence.current) return

        updateOverview({ publicationSelection: {
          key: selectionKey,
          versions: result.forecastVersions,
        } })
        updateOverview({ selectedPublication: result.forecastPublishTime })
        updateOverview({ analysisSelection: {
          key: `${selectionKey}|${result.forecastPublishTime ?? ''}`,
          data: result,
        } })
        updateOverview({ notice: '' })
      } catch (error) {
        if (!active || requestId !== requestSequence.current) return
        updateOverview({
          apiError: error instanceof Error
            ? error.message
            : 'Unable to connect to the backend.',
        })
      } finally {
        if (active && requestId === requestSequence.current) {
          updateOverview({ loading: false })
        }
      }
    }

    void updateView()
    return () => {
      active = false
    }
  }, [deliveryDate, period, selectionKey, refreshVersion])

  async function handlePublicationChange(publishTime: string) {
    if (!publicationOptions.some((version) => version.publishTime === publishTime)) {
      return
    }

    const requestId = ++requestSequence.current
    updateOverview({
      selectedPublication: publishTime,
      loading: true,
      apiError: '',
      notice: '',
    })

    try {
      const settlementPeriod = Number(period.match(/^SP\s+(\d+)/)?.[1])
      if (!settlementPeriod) {
        throw new Error('Please select a valid settlement period.')
      }

      const params = new URLSearchParams({
        delivery_date: deliveryDate,
        settlement_period: String(settlementPeriod),
        cutoff_time: '16:30',
        forecast_publish_time: publishTime,
      })
      const result = await requestWindAnalysis(params)
      if (requestId !== requestSequence.current) return
      if (result.forecastPublishTime !== publishTime) {
        throw new Error('The selected forecast publication did not match the response.')
      }

      updateOverview({ analysisSelection: {
        key: `${selectionKey}|${publishTime}`,
        data: result,
      } })
      updateOverview({ notice: '' })
    } catch (error) {
      if (requestId !== requestSequence.current) return
      updateOverview({
        apiError: error instanceof Error
          ? error.message
          : 'Unable to connect to the backend.',
      })
    } finally {
      if (requestId === requestSequence.current) {
        updateOverview({ loading: false })
      }
    }
  }

  const selected = rows.find((row) => `${row.period} · ${row.time}` === period) ?? rows[2]
  const hasSelectionChanged = analysisSelection !== null && analysis === null
  const forecast = analysis
    ? analysis.forecastAvailable ? analysis.forecastMW : null
    : null
  const actual = analysis
    ? analysis.actualAvailable ? analysis.actualMW : null
    : null
  const hasErrorValues = forecast !== null && actual !== null
  const signedError = hasErrorValues ? forecast - actual : null
  const absoluteError = signedError === null ? null : Math.abs(signedError)
  const percentageError =
    signedError !== null && actual !== null && actual !== 0
      ? (signedError / actual) * 100
      : null
  const chartMax = Math.max(forecast ?? 0, actual ?? 0)
  const barHeight = (value: number | null) =>
    value !== null && chartMax > 0 ? `${(value / chartMax) * 100}%` : '0%'
  const dataStatus = analysis
    ? 'live Elexon BMRS data'
    : loading
      ? 'retrieving live Elexon BMRS data'
      : hasSelectionChanged
        ? 'live data is out of date · click Update view'
        : 'live data unavailable'
  const valueSourceLabel = loading
    ? 'UPDATING LIVE DATA...'
    : analysis
      ? 'LIVE DATA · SELECTED DELIVERY PERIOD'
      : hasSelectionChanged
        ? 'LIVE DATA IS OUT OF DATE · CLICK UPDATE VIEW'
        : 'LIVE DATA NOT AVAILABLE FOR THIS SELECTION'
  const displayTime = selected.time

  const publishedTime = analysis?.forecastPublishTime
    ? formatPublicationTime(analysis.forecastPublishTime)
    : 'Unavailable'


  return (
    <div className="overview-page">
      <style>{styles}</style>
      <div className="filter-bar">
        <label><span>Delivery date</span><div className="input-wrap"><Icon name="calendar" /><input type="date" value={deliveryDate} onChange={(event) => updateOverview({ deliveryDate: event.target.value })} /></div></label>
        <label><span>Delivery period</span><select value={period} onChange={(event) => updateOverview({ period: event.target.value })}>{rows.map((row) => <option key={row.period}>{row.period} · {row.time}</option>)}</select></label>
        <label>
          <span>Forecast publish time</span>
          <select
            value={selectedPublication ?? ''}
            onChange={(event) => void handlePublicationChange(event.target.value)}
            disabled={loading || publicationOptions.length === 0}
          >
            {publicationOptions.length === 0
              ? <option value="">{loading ? 'Loading publications...' : 'No eligible publication available'}</option>
              : publicationOptions.map((version) => (
                <option key={version.publishTime} value={version.publishTime}>
                  {formatPublicationTime(version.publishTime)}
                </option>
              ))}
          </select>
        </label>
        <button className="primary" onClick={() => setRefreshVersion((version) => version + 1)} disabled={loading}>
          {loading ? 'Updating...': 'Update view'}
        </button>

        {notice && <span className="toast">{notice}</span>}
        {apiError && <span className="toast">{apiError}</span>}
      </div>

      <div className="section-heading"><div><h2>Decision-time forecast</h2><p>Forecast and actual wind generation comparison · {dataStatus}</p></div></div>
      <div className="summary-grid">
        <article className="forecast-card">
          <div className="eyebrow"><span>{valueSourceLabel}</span></div>
          <div className="comparison-body">
            <div className="comparison-data">
              <h3>{new Date(`${deliveryDate}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {displayTime} GMT</h3>
              <div className="value-pair">
                <div><span>Forecast</span><strong>{loading ? 'Updating...' : formatMW(forecast)} {forecast !== null && <small>MW</small>}</strong></div>
                <div>
                  <span>Actual</span>
                  <strong>
                    {loading ? 'Updating...' : formatMW(actual)}
                    {!loading && actual !== null && <small> MW</small>}

                    </strong>
                  </div>
              </div>
              {hasErrorValues && signedError !== null ? <>
                <div className="error-measures">
                  <div><span>Signed forecast error</span><b>{signedError > 0 ? '+' : ''}{formatMW(signedError)} MW</b></div>
                  <div><span>Absolute error</span><b>{formatMW(absoluteError)} MW</b></div>
                  <div><span>Percentage error</span><b>{percentageError === null ? 'Unavailable (actual is zero)' : `${percentageError > 0 ? '+' : ''}${percentageError.toFixed(2)}%`}</b></div>
                </div>
                <div className={`forecast-indicator ${signedError >= 0 ? 'over' : 'under'}`}>
                  <span className="indicator-arrow">{signedError >= 0 ? '↑' : '↓'}</span>
                  <div><b>{signedError >= 0 ? 'Overforecasting' : 'Underforecasting'}</b><small>Forecast is {formatMW(absoluteError)} MW {signedError >= 0 ? 'above' : 'below'} actual generation</small></div>
                </div>
              </> : <div className="data-unavailable">
                {loading
                  ? 'Loading the selected forecast and actual generation...'
                  : apiError
                    ? 'Live forecast error metrics are unavailable because the request failed.'
                    : `Forecast error metrics are unavailable: ${forecast === null ? 'forecast' : ''}${forecast === null && actual === null ? ' and ' : ''}${actual === null ? 'actual generation' : ''} data is missing.`}
              </div>}
            </div>
            <div className="comparison-visual">
              <Turbine />
              <div className="bar-chart" aria-label="Bar chart comparing forecast and actual generation">
                <div className="bar-column"><div className="bar forecast-bar" style={{ height: barHeight(forecast) }} /><b>{loading ? 'Updating...' : formatMW(forecast)}</b><span>Forecast</span></div>
                <div className="bar-column"><div className="bar actual-bar" style={{ height: barHeight(actual) }} /><b>{loading ? 'Updating...' : formatMW(actual)}</b><span>Actual</span></div>
              </div>
            </div>
          </div>
          <footer><div><span>Delivery date</span>
          <b>
            {new Date(`${deliveryDate}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </b>
          </div><div><span>Settlement period</span><b>{selected.period}</b></div><div><span>Forecast published</span><b>{publishedTime}</b></div></footer>
        </article>
        <article className="versions-card">
          <div className="card-title"><div><h3>Available WINDFOR publications</h3><p>Choose a forecast version published before the decision cut-off.</p></div><span>{publicationOptions.length} {publicationOptions.length === 1 ? 'version' : 'versions'}</span></div>
          {publicationOptions.length > 0
            ? <div className="versions-list">
              {publicationOptions.map((version, index) => (
                <button
                  type="button"
                  className={`version ${selectedPublication === version.publishTime ? 'selected' : ''}`}
                  key={version.publishTime}
                  aria-pressed={selectedPublication === version.publishTime}
                  onClick={() => void handlePublicationChange(version.publishTime)}
                >
                  <span className="radio" />
                  <div>
                    <b>{formatMW(version.forecastMW)} MW</b>
                    <small>{formatPublicationTime(version.publishTime)}</small>
                  </div>
                  {index === 0 && <em>Latest published</em>}
                </button>
              ))}
            </div>
            : <div className="rule-note" role="status">
              <Icon name="info" />
              No eligible forecast publication is available before the selected decision cut-off.
            </div>}
        </article>
      </div>

    </div>
  )
}
