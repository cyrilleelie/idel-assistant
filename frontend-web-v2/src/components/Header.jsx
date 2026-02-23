import { Calendar } from 'lucide-react';

export default function Header() {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
        <Calendar className="text-blue-600" size={32} />
        IDEL Planning Pro
      </h1>
      <p className="text-slate-500 mt-1">Gérez l'équipe, les créneaux, les patients et le planning mensuel.</p>
    </header>
  );
}
