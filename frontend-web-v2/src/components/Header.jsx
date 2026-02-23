import { Calendar, LogOut, HeartPulse, Building2, Receipt } from 'lucide-react';

const screens = [
  { id: 'cabinet', label: 'Cabinet', icon: Building2 },
  { id: 'soins', label: 'Soins', icon: HeartPulse },
  { id: 'facturation', label: 'Facturation', icon: Receipt },
];

export default function Header({ activeScreen, onScreenChange, onLogout }) {
  return (
    <header className="bg-white border-b border-slate-200 shadow-sm -mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-6 px-4 md:px-8">
      <div className="max-w-screen-2xl mx-auto flex items-center h-14 gap-8">

        {/* Logo / titre */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Calendar className="text-blue-600" size={22} />
          <span className="font-bold text-lg tracking-tight text-slate-900">IDEL Planning Pro</span>
        </div>

        {/* Navigation ecrans */}
        <nav className="flex items-center gap-1 flex-1">
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
