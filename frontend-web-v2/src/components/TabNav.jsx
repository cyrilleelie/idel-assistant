import { Calendar, CalendarDays, UserCircle, Users, Clock } from 'lucide-react';

const tabs = [
  { id: 'planning', label: 'Planning', icon: Calendar },
  { id: 'agendas', label: 'Agendas RDV', icon: CalendarDays },
  { id: 'patients', label: 'Patients', icon: UserCircle },
  { id: 'equipe', label: 'Équipe', icon: Users },
  { id: 'creneaux', label: 'Créneaux', icon: Clock },
];

export default function TabNav({ activeTab, setActiveTab }) {
  return (
    <nav className="flex space-x-2 mb-6 bg-white p-1 rounded-lg shadow-sm border border-slate-200 inline-flex flex-wrap gap-y-2">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setActiveTab(id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${activeTab === id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          <Icon size={18} /> {label}
        </button>
      ))}
    </nav>
  );
}
