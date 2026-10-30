const styles = `
.ui-method-note { margin-top: 14px; display: flex; align-items: flex-start; gap: 9px; padding: 12px 14px; background: var(--pale); border-radius: 8px; color: #4A6652; }
.ui-method-note .icon { color: var(--green); width: 16px; }
.ui-method-note b { display: block; font-size: 12px; margin-bottom: 3px; color: #315B3D; }
.ui-method-note span { display: block; font-size: 11px; line-height: 1.5; }
`

export default function AccuracyMethodNote() {
  return (
    <>
      <style>{styles}</style>
      <div className="ui-method-note">
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></svg>
        <p><b>Data sources and accuracy method</b><span>Historical comparisons use Elexon BMRS WINDFOR forecasts and AGWS actual generation. For each delivery day, the latest forecast published by 16:30 Europe/London on the previous day is selected; later publications are excluded. WINDFOR is hourly (odd settlement periods), and its forecast is assigned to each of the two half-hour settlement periods in that hour. Each half-hour actual is the sum of onshore and offshore wind; solar is excluded. Signed error = Forecast − Actual: positive means overforecasting. MAE and RMSE use absolute and squared errors respectively; bias is mean signed error. MAPE excludes observations with actual generation at or below 1 MW from its denominator only. Missing forecast or actual values are shown as gaps and excluded from error metrics, never replaced with zero.</span></p>
      </div>
    </>
  )
}
