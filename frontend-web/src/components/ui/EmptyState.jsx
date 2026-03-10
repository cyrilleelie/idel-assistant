import { FileText } from 'lucide-react';

export default function EmptyState({ icon: Icon = FileText, title, description, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
      <Icon size={32} className="text-slate-300 mb-3" />
      <p className="text-sm text-slate-500">{title}</p>
      {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
    </div>
  );
}
