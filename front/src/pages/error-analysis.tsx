import { useEffect, type FormEvent } from 'react'
import { useWindSightAppState } from '../app-state'
import {
  HISTORICAL_DATE_MAX,
  HISTORICAL_DATE_MIN,
  fetchHistoricalAccuracy,
} from '../api/historicalAccuracy'
import AccuracyMetrics from '../ui/components/AccuracyMetrics'
import LargestErrorsTable from '../ui/components/LargestErrorsTable'

const styles = `
.error-analysis-page .section-heading { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; }
.error-analysis-page .section-heading h2 { font-size: 18px; letter-spacing: -.2px; color: var(--green); }
.error-analysis-page .section-heading p { font-size: 12px; color: var(--muted); margin-top: 4px; }
.error-analysis-page .date-range-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; padding: 14px; margin-bottom: 12px; background: var(--white); border: 1px solid var(--line); border-radius: 9px; }
.error-analysis-page .date-range-form label { display: grid; gap: 5px; color: var(--green); font-size: 11px; font-weight: 700; }
.error-analysis-page .date-range-form input { height: 34px; min-width: 150px; border: 1px solid #D9DED9; border-radius: 7px; background: var(--white); color: #343934; padding: 0 9px; outline: none; font-size: 13px; }
.error-analysis-page .date-range-form input:focus { border-color: var(--green); box-shadow: 0 0 0 2px var(--pale); }
.error-analysis-page .date-range-form button { min-height: 34px; padding: 0 14px; border: 0; border-radius: 7px; background: var(--green); color: white; font-size: 12px; font-weight: 700; }
.error-analysis-page .date-range-form button:disabled { opacity: .6; cursor: wait; }
.error-analysis-page .request-status { margin: 12px 0; padding: 11px 13px; border-radius: 8px; background: var(--pale); color: var(--green); font-size: 12px; }
.error-analysis-page .request-status.error { background: #FFF1EE; color: #8B3328; }
.error-analysis-page .availability-note { margin-top: 9px; color: var(--muted); font-size: 11px; line-height: 1.5; }
@media (max-width: 600px) {
  .error-analysis-page .section-heading { align-items: flex-start; flex-direction: column; gap: 10px; }
  .error-analysis-page .date-range-form { align-items: stretch; flex-direction: column; }
  .error-analysis-page .date-range-form input { width: 100%; }
}
`

export default function ErrorAnalysis() {
  const { errorAnalysis, setErrorAnalysis } = useWindSightAppState()
  const {
    draftStart,
    draftEnd,
    appliedRange,
    validationError,
    result,
    loading,
    error,
  } = errorAnalysis

  useEffect(() => {
    const controller = new AbortController()
    setErrorAnalysis((state) => ({ ...state, loading: true, error: '' }))

    async function loadHistoricalAccuracy() {
      try {
        const loadedResult = await fetchHistoricalAccuracy(appliedRange, controller.signal)
        setErrorAnalysis((state) => ({ ...state, result: loadedResult }))
      } catch (requestError) {
        if (controller.signal.aborted) return
        setErrorAnalysis((state) => ({
          ...state,
          error: requestError instanceof Error
            ? requestError.message
            : 'Could not load historical error analysis data.',
        }))
      } finally {
        if (!controller.signal.aborted) {
          setErrorAnalysis((state) => ({ ...state, loading: false }))
        }
      }
    }

    void loadHistoricalAccuracy()
    return () => controller.abort()
  }, [appliedRange, setErrorAnalysis])

  function applyDateRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorAnalysis((state) => ({ ...state, validationError: '' }))
    if (draftStart > draftEnd) {
      setErrorAnalysis((state) => ({
        ...state,
        validationError: 'Delivery date from must be on or before delivery date to.',
      }))
      return
    }
    if (
      result &&
      !loading &&
      !error &&
      result.startDate === draftStart &&
      result.endDate === draftEnd
    ) {
      return
    }
    setErrorAnalysis((state) => ({
      ...state,
      error: '',
      loading: true,
      appliedRange: { startDate: draftStart, endDate: draftEnd },
    }))
  }

  const rangeLabel = result
    ? `${result.startDate} to ${result.endDate}`
    : `${appliedRange.startDate} to ${appliedRange.endDate}`

  return (
    <div className="error-analysis-page">
      <style>{styles}</style>
      <div className="section-heading">
        <div><h2>Error summary</h2><p>Historical Elexon WINDFOR forecasts matched with AGWS wind generation</p></div>
      </div>

      <form className="date-range-form" onSubmit={applyDateRange}>
        <label>
          Delivery date from
          <input
            aria-label="Delivery date from"
            type="date"
            min={HISTORICAL_DATE_MIN}
            max={HISTORICAL_DATE_MAX}
            required
            value={draftStart}
            onChange={(event) => setErrorAnalysis((state) => ({ ...state, draftStart: event.target.value }))}
          />
        </label>
        <label>
          Delivery date to
          <input
            aria-label="Delivery date to"
            type="date"
            min={HISTORICAL_DATE_MIN}
            max={HISTORICAL_DATE_MAX}
            required
            value={draftEnd}
            onChange={(event) => setErrorAnalysis((state) => ({ ...state, draftEnd: event.target.value }))}
          />
        </label>
        <button type="submit" disabled={loading}>Apply range</button>
      </form>

      {validationError && <div className="request-status error" role="alert">{validationError}</div>}
      {loading && <div className="request-status" role="status">
        {result
          ? `Refreshing ${appliedRange.startDate} to ${appliedRange.endDate}. Showing the last loaded range until the update completes…`
          : `Loading historical Elexon records for ${appliedRange.startDate} to ${appliedRange.endDate}…`}
      </div>}
      {error && <div className="request-status error" role="alert">
        {error}{result ? ' The last successfully loaded range remains visible.' : ''}
      </div>}

      {result && <>
        {result.matchedCount === 0 && (
          <div className="request-status" role="status">
            No matched forecast and actual observations are available for this range. Missing values are not substituted.
          </div>
        )}
        <AccuracyMetrics metrics={result.metrics} />
        <LargestErrorsTable range={rangeLabel} records={result.data} />
        <p className="availability-note">
          Sources: {result.forecastDataset} forecast and {result.actualDataset} actuals from {result.source}. {result.dataAvailability.forecastRecords} half-hour forecast slots · {result.dataAvailability.actualHalfHourlyPeriods} complete half-hourly actual periods · {result.dataAvailability.forecastMissingPeriods} missing forecast slots · {result.dataAvailability.actualMissingPeriods} missing actual slots.
        </p>
      </>}
    </div>
  )
}
