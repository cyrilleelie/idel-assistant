import { Phone, MapPin } from 'lucide-react';

export default function PatientCard({ patient, onClick }) {
  const isInactive = patient.active === false;

  return (
    <div onClick={onClick} className={`border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer group ${isInactive ? 'bg-slate-100 border-slate-200 opacity-70' : 'bg-slate-50 border-slate-200 hover:border-blue-300'}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border transition-colors ${isInactive ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-blue-100 text-blue-700 border-blue-200 group-hover:bg-blue-600 group-hover:text-white'}`}>
          {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 uppercase truncate">{patient.lastName} <span className="capitalize font-medium">{patient.firstName}</span></h3>
            {isInactive && <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider bg-slate-300 text-slate-600 px-2 py-0.5 rounded-full">Inactif</span>}
          </div>
          <span className="text-xs text-slate-500">{patient.ssn || 'SSN non renseigné'}</span>
        </div>
      </div>
      <div className="space-y-1.5 text-sm text-slate-600">
        {patient.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-slate-400"/> {patient.phone}</div>}
        {patient.address && <div className="flex items-start gap-2"><MapPin size={14} className="text-slate-400 mt-0.5 shrink-0"/> <span className="line-clamp-1">{patient.address}</span></div>}
      </div>
    </div>
  );
}
