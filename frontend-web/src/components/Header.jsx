import { Search, Bell, LogOut, Stethoscope } from 'lucide-react';

const screens = [
  { id: 'cabinet', label: 'Cabinet' },
  { id: 'patients', label: 'Patients' },
  { id: 'agendas', label: 'Agenda' },
  { id: 'tournee', label: 'Ma Tournée' },
  { id: 'facturation', label: 'Facturation' },
  { id: 'administration', label: 'Administration' },
];

export default function Header({ activeScreen, onScreenChange, onLogout, pendingFacturationCount = 0, userName }) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo + Nav */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-1.5 rounded-lg text-white">
              <Stethoscope size={22} />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">IDEL Planning Pro</h1>
          </div>

          <nav className="hidden lg:flex items-center gap-1">
            {screens.map(({ id, label }) => {
              const isActive = activeScreen === id;
              const isFact = id === 'facturation';
              const showBadge = isFact && pendingFacturationCount > 0;
              return (
                <button
                  key={id}
                  onClick={() => onScreenChange(id)}
                  className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary font-semibold border-b-2 border-primary'
                      : 'text-slate-600 hover:text-primary'
                  }`}
                >
                  {label}
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                      {pendingFacturationCount > 9 ? '9+' : pendingFacturationCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right side: search + notifications + avatar + logout */}
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher..."
              className="bg-slate-100 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/30 w-64"
            />
          </div>

          <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
            <Bell size={20} />
          </button>

          <div className="h-8 w-px bg-slate-200" />

          <div className="w-9 h-9 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-sm cursor-pointer hover:border-primary transition-colors">
            {userName ? userName.charAt(0).toUpperCase() : 'U'}
          </div>

          <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            title="Déconnexion"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
