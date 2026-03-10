const VARIANTS = {
  // Appointment statuses
  scheduled: { label: 'Planifi\u00e9', cls: 'bg-slate-100 text-slate-600' },
  confirmed: { label: 'Confirm\u00e9', cls: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Termin\u00e9', cls: 'bg-emerald-100 text-emerald-700' },
  canceled: { label: 'Annul\u00e9', cls: 'bg-red-100 text-red-600' },
  no_show: { label: 'Absent', cls: 'bg-amber-100 text-amber-700' },
  // Invoice statuses
  draft: { label: 'Brouillon', cls: 'bg-slate-100 text-slate-600' },
  validated: { label: 'Valid\u00e9e', cls: 'bg-emerald-100 text-emerald-700' },
  transmitted: { label: 'Envoy\u00e9e', cls: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Pay\u00e9e', cls: 'bg-emerald-100 text-emerald-700' },
  // Transmission statuses
  pending_transcription: { label: 'Transcription...', cls: 'bg-amber-100 text-amber-700' },
  pending_synthesis: { label: 'Synth\u00e8se...', cls: 'bg-amber-100 text-amber-700' },
  transcribed: { label: 'Transcrit', cls: 'bg-blue-100 text-blue-700' },
  // FSE statuses
  generated: { label: 'G\u00e9n\u00e9r\u00e9e', cls: 'bg-slate-100 text-slate-600' },
  exported: { label: 'Export\u00e9e', cls: 'bg-blue-100 text-blue-700' },
  rejected: { label: 'Rejet\u00e9e', cls: 'bg-red-100 text-red-600' },
  // Generic
  active: { label: 'Actif', cls: 'bg-emerald-100 text-emerald-700' },
  inactive: { label: 'Inactif', cls: 'bg-slate-100 text-slate-600' },
  default: { label: '', cls: 'bg-slate-100 text-slate-600' },
};

export default function Badge({ variant = 'default', label, className = '' }) {
  const config = VARIANTS[variant] || VARIANTS.default;
  const displayLabel = label || config.label || variant;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.cls} ${className}`}>
      {displayLabel}
    </span>
  );
}
