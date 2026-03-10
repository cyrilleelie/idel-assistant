import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ size = 20, className = '', label }) {
  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <Loader2 size={size} className="animate-spin text-slate-400" />
      {label && <span className="ml-2 text-sm text-slate-500">{label}</span>}
    </div>
  );
}
