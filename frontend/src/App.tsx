import './index.css';
import { useState } from 'react';
import ConciliacionPage from './ConciliacionPage';
import { getCurrentUser } from './userContext';

type Tab = 'conciliacion' | 'auditoria';

const isSA = getCurrentUser().tipo === 1;

function App() {
  const [tab, setTab] = useState<Tab>('conciliacion');

  return (
    <ConciliacionPage
      isSA={isSA}
      activeTab={tab}
      onTabChange={setTab}
    />
  );
}

export default App;
