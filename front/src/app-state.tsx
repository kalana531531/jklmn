import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import {
  DEFAULT_HISTORICAL_DATE_RANGE,
  type DateRange,
  type HistoricalAccuracyResponse,
} from './api/historicalAccuracy'

export type ForecastVersion = {
  publishTime: string
  forecastMW: number
}

export type WindAnalysis = {
  source: string
  forecastDataset: string
  actualDataset: string
  deliveryDate: string
  requestedSettlementPeriod: number
  forecastSettlementPeriod: number
  cutoffLocal: string
  cutoffUTC: string
  forecastPublishTime: string | null
  forecastVersions: ForecastVersion[]
  forecastMW: number | null
  actualMW: number | null
  forecastErrorMW: number | null
  absoluteErrorMW: number | null
  forecastAvailable: boolean
  actualAvailable: boolean
}

type AnalysisSelection = {
  key: string
  data: WindAnalysis
}

type PublicationSelection = {
  key: string
  versions: ForecastVersion[]
}

export type OverviewPageState = {
  period: string
  notice: string
  deliveryDate: string
  analysisSelection: AnalysisSelection | null
  publicationSelection: PublicationSelection | null
  selectedPublication: string | null
  loading: boolean
  apiError: string
}

export type HistoricalPageState = {
  draftStart: string
  draftEnd: string
  appliedRange: DateRange
  validationError: string
  result: HistoricalAccuracyResponse | null
  loading: boolean
  error: string
}

type WindSightAppState = {
  overview: OverviewPageState
  setOverview: Dispatch<SetStateAction<OverviewPageState>>
  comparison: HistoricalPageState
  setComparison: Dispatch<SetStateAction<HistoricalPageState>>
  errorAnalysis: HistoricalPageState
  setErrorAnalysis: Dispatch<SetStateAction<HistoricalPageState>>
}

const initialHistoricalPageState = (): HistoricalPageState => ({
  draftStart: DEFAULT_HISTORICAL_DATE_RANGE.startDate,
  draftEnd: DEFAULT_HISTORICAL_DATE_RANGE.endDate,
  appliedRange: { ...DEFAULT_HISTORICAL_DATE_RANGE },
  validationError: '',
  result: null,
  loading: true,
  error: '',
})

const WindSightAppStateContext = createContext<WindSightAppState | null>(null)

export function WindSightAppStateProvider({ children }: { children: ReactNode }) {
  const [overview, setOverview] = useState<OverviewPageState>({
    period: 'SP 19 · 09:00',
    notice: '',
    deliveryDate: '2026-01-06',
    analysisSelection: null,
    publicationSelection: null,
    selectedPublication: null,
    loading: true,
    apiError: '',
  })
  const [comparison, setComparison] = useState(initialHistoricalPageState)
  const [errorAnalysis, setErrorAnalysis] = useState(initialHistoricalPageState)

  return (
    <WindSightAppStateContext.Provider value={{
      overview,
      setOverview,
      comparison,
      setComparison,
      errorAnalysis,
      setErrorAnalysis,
    }}>
      {children}
    </WindSightAppStateContext.Provider>
  )
}

export function useWindSightAppState() {
  const state = useContext(WindSightAppStateContext)
  if (!state) {
    throw new Error('WindSight pages must be rendered inside WindSightAppStateProvider.')
  }
  return state
}
