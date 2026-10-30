import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import AccuracyMetrics from './AccuracyMetrics'
import type { HistoricalAccuracyRecord } from '../../api/historicalAccuracy'
import ForecastActualChart, {
  formatMW,
  formatSignedMW,
} from './ForecastActualChart'

function record(
  settlementPeriod: number,
  forecastMW: number | null,
  actualMW: number | null,
): HistoricalAccuracyRecord {
  const timestamp = new Date(Date.UTC(2026, 0, 6, 0, (settlementPeriod - 1) * 30))
    .toISOString()
  return {
    deliveryDate: '2026-01-06',
    settlementPeriod,
    timestamp,
    forecastMW,
    actualMW,
    forecastErrorMW:
      forecastMW !== null && actualMW !== null ? forecastMW - actualMW : null,
    forecastPublishTime: forecastMW === null ? null : '2026-01-05T15:30:00Z',
    cutoffTime: '2026-01-05T16:30:00Z',
  }
}

describe('historical forecast chart', () => {
  it('formats tooltip values with up to three decimals without trailing zeros', () => {
    expect(formatMW(7060.485)).toBe('7,060.485')
    expect(formatMW(7688)).toBe('7,688')
    expect(formatSignedMW(627.515)).toBe('+627.515 MW')
    expect(formatSignedMW(-627.5)).toBe('−627.5 MW')
  })

  it('preserves missing settlement periods as breaks in each line', () => {
    const markup = renderToStaticMarkup(createElement(ForecastActualChart, {
      records: [
        record(1, 5200, 4900),
        record(2, 5100, null),
        record(3, null, 4800),
        record(4, 5000, 4700),
      ],
      startDate: '2026-01-06',
      endDate: '2026-01-06',
    }))
    const forecastPath = markup.match(
      /<path class="ui-chart-forecast-line" d="([^"]*)"/,
    )?.[1]
    const actualPath = markup.match(
      /<path class="ui-chart-actual-line" d="([^"]*)"/,
    )?.[1]

    expect(forecastPath).toBeDefined()
    expect(actualPath).toBeDefined()
    expect(forecastPath?.match(/M /g)).toHaveLength(2)
    expect(actualPath?.match(/M /g)).toHaveLength(2)
    expect(markup.match(/fill="transparent"/g)).toHaveLength(4)
    expect(markup).not.toContain('Illustrative demo data')
  })

  it('shows backend metrics and matched half-hour observation count', () => {
    const markup = renderToStaticMarkup(createElement(AccuracyMetrics, {
      metrics: {
        mae: 300,
        rmse: 300,
        mapePercent: 6.122,
        bias: 300,
        count: 1,
        mapeCount: 1,
      },
    }))

    expect(markup).toContain('300 MW')
    expect(markup).toContain('6.122%')
    expect(markup).toContain('1 matched half-hour periods')
  })

  it('displays historical accuracy metrics to three decimals without trailing zeros', () => {
    const markup = renderToStaticMarkup(createElement(AccuracyMetrics, {
      metrics: {
        mae: 627.515,
        rmse: 627.515,
        mapePercent: 8.89,
        bias: 627.515,
        count: 1,
        mapeCount: 1,
      },
    }))

    expect(markup.match(/627\.515 MW/g)).toHaveLength(3)
    expect(markup).toContain('8.89%')
    expect(markup).not.toContain('8.890%')
  })

  it('provides accessible metric tooltips with the requested explanations', () => {
    const markup = renderToStaticMarkup(createElement(AccuracyMetrics, {
      metrics: {
        mae: 300,
        rmse: 350,
        mapePercent: 6.122,
        bias: -40,
        count: 12,
        mapeCount: 10,
      },
    }))

    expect(markup.match(/role="tooltip"/g)).toHaveLength(5)
    expect(markup).toContain('aria-label="About Mean Absolute Error (MAE)"')
    expect(markup).toContain('average absolute difference between forecast and actual generation, measured in MW')
    expect(markup).toContain('Larger forecasting errors have a greater impact')
    expect(markup).toContain('Records with actual generation at or below 1 MW are excluded')
    expect(markup).toContain('Positive means overforecasting; negative means underforecasting')
    expect(markup).toContain('number of half-hour periods with both valid forecast and actual generation data')
    expect(markup).not.toContain('<button')
    expect(markup).toContain('tabindex="0"')
    expect(markup).toContain('.ui-info-wrap:hover .ui-info-tooltip')
    expect(markup).not.toContain('is-open')
  })
})
