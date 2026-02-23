import { Receipt } from 'lucide-react';

export default function FacturationTab() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-6">
        <Receipt size={32} className="text-slate-400" />
      </div>
      <h2 className="text-xl font-semibold text-slate-700 mb-2">Facturation</h2>
      <p className="text-slate-500 max-w-sm">
        Le module de facturation est en cours de développement. Il sera disponible prochainement.
      </p>
    </div>
  );
}
