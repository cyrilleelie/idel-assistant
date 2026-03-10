import { Phone, Mail } from 'lucide-react';

export default function NurseCard({ nurse, onClick }) {
  const isInactive = nurse.active === false;

  return (
    <div onClick={onClick} className={`w-72 border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col group ${isInactive ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
      <div className={`h-2 ${isInactive ? 'bg-slate-300' : nurse.color.split(' ')[0]}`}></div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border group-hover:scale-105 transition-transform ${isInactive ? 'bg-slate-200 text-slate-500 border-slate-300' : nurse.color}`}>{nurse.firstName.charAt(0)}{nurse.lastName.charAt(0)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 uppercase truncate">{nurse.lastName} <span className="capitalize font-medium">{nurse.firstName}</span></h3>
              {isInactive && <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider bg-slate-300 text-slate-600 px-2 py-0.5 rounded-full">Inactif</span>}
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{nurse.role}</span>
          </div>
        </div>
        <div className="space-y-2 mt-auto text-sm text-slate-600">
          {nurse.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-slate-400" /> <span>{nurse.phone}</span></div>}
          {nurse.email && <div className="flex items-center gap-2"><Mail size={14} className="text-slate-400" /> <span>{nurse.email}</span></div>}
        </div>
      </div>
    </div>
  );
}
