import { useState } from 'react';
import { ConvertTab } from './tabs/ConvertTab.js';
import { MonitorTab } from './tabs/MonitorTab.js';
import { InventoryTab } from './tabs/InventoryTab.js';
import { CoordinationTab } from './tabs/CoordinationTab.js';
import { AllocationTab } from './tabs/AllocationTab.js';
import { DeploymentTab } from './tabs/DeploymentTab.js';

type TabId = 'convert' | 'monitor' | 'inventory' | 'coordination' | 'allocation' | 'deployment';

interface TabDef {
  id: TabId;
  label: string;
  planned?: boolean;
}

const TABS: TabDef[] = [
  { id: 'convert', label: 'Convert' },
  { id: 'monitor', label: 'Monitor' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'coordination', label: 'Coordination' },
  { id: 'allocation', label: 'Allocation' },
  { id: 'deployment', label: 'Deployment' },
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
        {tab === 'inventory' && <InventoryTab />}
        {tab === 'coordination' && <CoordinationTab />}
        {tab === 'allocation' && <AllocationTab />}
        {tab === 'deployment' && <DeploymentTab />}
      </main>

      <footer className="app__footer">
        AI-assisted build · combines wsm-wwb-bridge, pmse-to-wwb and MicWizard · verify
        experimental exports before a live show.
      </footer>
    </div>
  );
}
