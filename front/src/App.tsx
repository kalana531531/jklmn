import { useState } from 'react'
import { WindSightAppStateProvider } from './app-state'
import Comparison from './pages/comparison'
import ErrorAnalysis from './pages/error-analysis'
import Overview from './pages/overview'

type Tab = 'Overview' | 'Comparison' | 'Error analysis'
type IconName = 'overview' | 'compare' | 'error' | 'chevron'

function Icon({ name }: { name: IconName }) {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    compare: <><path d="M4 19V5m0 14h16" /><path d="m7 15 4-4 3 2 5-6" /></>,
    error: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5m0 3h.01" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
  }

  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{paths[name]}</svg>
}

const navigation: { label: Tab; icon: IconName }[] = [
  { label: 'Overview', icon: 'overview' },
  { label: 'Comparison', icon: 'compare' },
  { label: 'Error analysis', icon: 'error' },
]

const pageDescriptions: Record<Tab, string> = {
  Overview: 'National wind generation forecasts and performance',
  Comparison: 'Matched forecast and actual wind generation periods',
  'Error analysis': 'Historical forecast errors and significant deviations',
}

export default function App() {
  const [tab, setTab] = useState<Tab>('Overview')
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(() => new Set(['Overview']))

  return (
    <WindSightAppStateProvider>
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><span /><span /><span /></div><div><b>WindSight</b><small>UK Generation Intelligence</small></div></div>
        <nav>
          <p>WORKSPACE</p>
          {navigation.map(({ label, icon }) => <button key={label} className={tab === label ? 'active' : ''} onClick={() => {
            setTab(label)
            setVisitedTabs((visited) => new Set(visited).add(label))
          }}><Icon name={icon} />{label}</button>)}
        </nav>
        <div className="user"><span>UT</span><div><b>Utility Trading</b><small>Operations team</small></div><Icon name="chevron" /></div>
      </aside>

      <main>
        <header>
          <div><h1>{tab}</h1><p>{pageDescriptions[tab]}</p></div>
          <div className="timezone"><span className="status-dot" />2026/01/05 · 19:00 GMT</div>
        </header>

        <section className="content">
          {visitedTabs.has('Overview') && <div hidden={tab !== 'Overview'}><Overview /></div>}
          {visitedTabs.has('Comparison') && <div hidden={tab !== 'Comparison'}><Comparison /></div>}
          {visitedTabs.has('Error analysis') && <div hidden={tab !== 'Error analysis'}><ErrorAnalysis /></div>}
        </section>
      </main>
    </div>
    </WindSightAppStateProvider>
  )
}
