import { Calendar, LogOut, UserCircle, CalendarDays, Building2, Receipt, Route } from 'lucide-react';

const screens = [
  { id: 'cabinet', label: 'Cabinet', icon: Building2 },
  { id: 'patients', label: 'Patients', icon: UserCircle },
  { id: 'agendas', label: 'Agenda', icon: CalendarDays },
  { id: 'tournee', label: 'Ma Tournée', icon: Route },
  { id: 'facturation', label: 'Facturation', icon: Receipt },
];

export default function Header({ activeScreen, onScreenChange, onLogout }) {
  return (
    <header className="bg-white border-b border-slate-200 shadow-sm -mx-3 md:-mx-4 -mt-3 md:-mt-4 mb-6 px-3 md:px-4">
      <div className="flex items-center justify-center h-14 gap-8">

        {/* Logo / titre */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Calendar className="text-blue-600" size={22} />
          <span className="font-bold text-lg tracking-tight text-slate-900">IDEL Planning Pro</span>
        </div>

        {/* Navigation ecrans */}
        <nav className="flex items-center gap-1">
          {screens.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onScreenChange(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeScreen === id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        {/* Deconnexion */}
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
        >
          <LogOut size={16} />
          Déconnexion
        </button>

      </div>
    </header>
  );
}
