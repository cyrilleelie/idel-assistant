import { useState } from 'react';
import { Database, ScrollText } from 'lucide-react';
import AdminBddTab from './AdminBddTab';
import LogsTab from './LogsTab';

const TABS = [
  { id: 'bdd', label: 'Base de données', icon: Database },
  { id: 'logs', label: 'Logs', icon: ScrollText },
];

export default function AdministrationScreen() {
  const [activeTab, setActiveTab] = useState('bdd');

  return (
    <div className="space-y-0">
      {/* Barre d'onglets */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {activeTab === 'bdd' && <AdminBddTab />}
      {activeTab === 'logs' && <LogsTab />}
    </div>
  );
}
