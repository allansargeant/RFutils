import { useState } from 'react';
import { ConvertTab } from './tabs/ConvertTab.js';
import { MonitorTab } from './tabs/MonitorTab.js';
import { PlaceholderTab } from './tabs/PlaceholderTab.js';

type TabId = 'convert' | 'monitor' | 'coordination' | 'allocation' | 'deployment';

interface TabDef {
  id: TabId;
  label: string;
  planned?: boolean;
}

const TABS: TabDef[] = [
  { id: 'convert', label: 'Convert' },
  { id: 'monitor', label: 'Monitor' },
  { id: 'coordination', label: 'Coordination', planned: true },
  { id: 'allocation', label: 'Allocation', planned: true },
  { id: 'deployment', label: 'Deployment', planned: true },
];

export function App(): JSX.Element {
  const [tab, setTab] = useState<TabId>('convert');

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <h1>RFutils</h1>
          <span className="app__tagline">RF coordination &amp; wireless-mic suite</span>
        </div>
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`tabs__tab${tab === t.id ? ' tabs__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.planned && <span className="tabs__soon">soon</span>}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === 'convert' && <ConvertTab />}
        {tab === 'monitor' && <MonitorTab />}
        {tab === 'coordination' && (
          <PlaceholderTab
            title="Frequency coordination"
            blurb="Run intermodulation-aware coordination across your whole inventory instead of importing pre-coordinated lists — the natural next step once WSM/WWB files and live devices share one model here."
            bullets={[
              'Compute compatible frequency sets with IM3/IM5 exclusion',
              'Respect Ofcom PMSE licences and local TV allocations as constraints',
              'Reserve backups per zone and export straight to WWB / WSM',
            ]}
          />
        )}
        {tab === 'allocation' && (
          <PlaceholderTab
            title="Allocation"
            blurb="Assign coordinated frequencies to specific talent, channels and receivers, tracking who carries what across a multi-day, multi-zone production."
            bullets={[
              'Map channels to talent / role and to physical receiver slots',
              'Per-zone and per-day allocation with conflict detection',
              'Label sheets and paperwork generated from the same data',
            ]}
          />
        )}
        {tab === 'deployment' && (
          <PlaceholderTab
            title="Deployment"
            blurb="Push allocations to the gear and confirm they landed — closing the loop between the plan and the live receivers already visible on the Monitor tab."
            bullets={[
              'Deploy frequencies to Shure / Sennheiser receivers over the network',
              'Verify deployed tuning against the plan and flag drift',
              'One-click re-deploy when coordination changes mid-show',
            ]}
          />
        )}
      </main>

      <footer className="app__footer">
        AI-assisted build · combines wsm-wwb-bridge, pmse-to-wwb and MicWizard · verify
        experimental exports before a live show.
      </footer>
    </div>
  );
}
