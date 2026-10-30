import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { HistoricalAccuracyRecord } from '../../api/historicalAccuracy'
import LargestErrorsTable from './LargestErrorsTable'

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

describe('largest historical errors table', () => {
  it('shows matched real records in descending absolute-error order', () => {
    const markup = renderToStaticMarkup(createElement(LargestErrorsTable, {
      range: '06 Jan 2026',
      records: [
        record(1, 3020, 3000),
        record(2, 4000, 4150),
        record(3, 5000, 4850),
        record(4, null, 4800),
      ],
    }))

    expect(markup).toContain('Largest absolute errors')
    expect(markup).not.toContain('demo data')
    expect(markup).toContain('Delivery date/time')
    expect(markup).toContain('Settlement period')
    expect(markup).toContain('Forecast published')
    expect(markup).toContain('−150 MW')
    expect(markup).toContain('+150 MW')
    expect(markup.indexOf('4,000 MW')).toBeLessThan(markup.indexOf('5,000 MW'))
    expect(markup.indexOf('5,000 MW')).toBeLessThan(markup.indexOf('3,020 MW'))
    expect(markup).not.toContain('4,800 MW')
  })

  it('shows an explicit no-matched-records state', () => {
    const markup = renderToStaticMarkup(createElement(LargestErrorsTable, {
      range: '06 Jan 2026',
      records: [record(1, 3000, null)],
    }))

    expect(markup).toContain('No matched forecast and actual records')
  })

  it('displays forecast, actual and error precision up to three decimals', () => {
    const markup = renderToStaticMarkup(createElement(LargestErrorsTable, {
      range: '06 Jan 2026',
      records: [record(19, 7688, 7060.485)],
    }))

    expect(markup).toContain('7,688 MW')
    expect(markup).toContain('7,060.485 MW')
    expect(markup).toContain('+627.515 MW')
    expect(markup).toContain('627.515 MW')
  })
})
