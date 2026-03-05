import { useState } from 'react';
import {
  Mic, Edit3, CheckCircle2, RefreshCw, Tag, ChevronDown, ChevronUp,
  AlertTriangle, Calendar, Clock
} from 'lucide-react';

const STATUS_CONFIG = {
  draft: { label: 'Brouillon', color: 'bg-slate-100 text-slate-600', border: 'border-l-slate-400' },
  pending_transcription: { label: 'En cours...', color: 'bg-orange-100 text-orange-700', border: 'border-l-orange-400' },
  pending_synthesis: { label: 'Synthese IA...', color: 'bg-orange-100 text-orange-700', border: 'border-l-orange-400' },
  transcribed: { label: 'Transcrit', color: 'bg-blue-100 text-blue-700', border: 'border-l-blue-400' },
  completed: { label: 'Complet', color: 'bg-blue-100 text-blue-700', border: 'border-l-blue-500' },
  validated: { label: 'Valide', color: 'bg-emerald-100 text-emerald-700', border: 'border-l-emerald-500' },
  error: { label: 'Erreur', color: 'bg-red-100 text-red-700', border: 'border-l-red-500' },
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function toText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(toText).join(', ');
  if (typeof value === 'object') return Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(', ');
  return String(value);
}

export default function TransmissionCard({
  transmission,
  authorName,
  onEdit,
  onValidate,
  onRegenerateSynthesis,
  onManagePrescriptions,
  compact = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const t = transmission;
  const statusCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.draft;
  const structured = t.structured_data || {};
  const hasSynthesis = structured.synthese || structured.soins || structured.constantes || structured.observations;
  const alerts = structured.alertes || structured.alerts || [];
  const hasAlerts = alerts.length > 0;
  const isVocal = t.type === 'vocal';
  const isLocked = t.status === 'validated';
  const isPending = t.status === 'pending_transcription' || t.status === 'pending_synthesis';

  return (
    <div className={`border rounded-lg border-l-4 ${statusCfg.border} ${hasAlerts ? 'bg-orange-50/40' : 'bg-white'} ${compact ? 'p-3' : 'p-4'} transition-all`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isVocal ? <Mic size={14} className="text-purple-500 shrink-0" /> : <Edit3 size={14} className="text-slate-400 shrink-0" />}
          <span className="text-sm font-medium text-slate-700 truncate">
            {authorName || 'IDEL'}
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Calendar size={12} /> {formatDate(t.created_at)}
            <Clock size={12} className="ml-1" /> {formatTime(t.created_at)}
          </span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      {/* Prescription badges */}
      {!compact && t.prescriptions && t.prescriptions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {t.prescriptions.map(p => (
            <span key={p.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Tag size={10} />
              {p.prescriber_name ? `Dr ${p.prescriber_name}` : ''}{p.label ? ` — ${p.label}` : ''}
              {p.is_auto_resolved && <span className="text-indigo-400 ml-0.5">(auto)</span>}
            </span>
          ))}
        </div>
      )}

      {/* Synthesis */}
      {isPending && (
        <div className="mt-3 space-y-2">
          <div className="h-3 bg-slate-200 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-slate-200 rounded animate-pulse w-1/2" />
        </div>
      )}

      {hasSynthesis && !isPending && (
        <div className={`mt-3 bg-slate-50 border border-slate-200 rounded-lg ${compact ? 'p-2' : 'p-3'} space-y-1`}>
          {structured.synthese && (
            <p className={`text-sm text-slate-700 ${compact ? 'line-clamp-2' : ''}`}>
              {toText(structured.synthese)}
            </p>
          )}
          {!compact && (
            <>
              {structured.soins && (
                <p className="text-xs text-slate-600"><span className="font-medium">Soins :</span> {toText(structured.soins)}</p>
              )}
              {structured.constantes && (
                <p className="text-xs text-slate-600"><span className="font-medium">Constantes :</span> {toText(structured.constantes)}</p>
              )}
              {structured.observations && (
                <p className="text-xs text-slate-600"><span className="font-medium">Observations :</span> {toText(structured.observations)}</p>
              )}
              {structured.actions && (
                <p className="text-xs text-slate-600"><span className="font-medium">Actions :</span> {toText(structured.actions)}</p>
              )}
            </>
          )}
          {alerts.map((alert, i) => (
            <p key={i} className="text-xs text-orange-700 flex items-center gap-1">
              <AlertTriangle size={12} className="shrink-0" /> {alert}
            </p>
          ))}
        </div>
      )}

      {/* Draft without synthesis — show transcription directly */}
      {!hasSynthesis && !isPending && t.transcription && (
        <p className={`mt-3 text-sm text-slate-600 ${compact ? 'line-clamp-2' : ''}`}>
          {t.transcription}
        </p>
      )}

      {/* Expandable transcription */}
      {!compact && hasSynthesis && t.transcription && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Masquer la transcription' : 'Voir la transcription complete'}
        </button>
      )}
      {expanded && (
        <div className="mt-2 text-sm text-slate-600 bg-slate-50 rounded p-3 border border-slate-200 whitespace-pre-wrap">
          {t.transcription}
        </div>
      )}

      {/* Actions */}
      {!compact && !isLocked && (
        <div className="mt-3 flex flex-wrap gap-2">
          {onEdit && t.status !== 'pending_transcription' && (
            <button onClick={onEdit} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1">
              <Edit3 size={12} /> Corriger
            </button>
          )}
          {onValidate && !isPending && (
            <button onClick={onValidate} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors flex items-center gap-1">
              <CheckCircle2 size={12} /> Valider
            </button>
          )}
          {onRegenerateSynthesis && t.transcription && !isPending && (
            <button onClick={onRegenerateSynthesis} className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors flex items-center gap-1">
              <RefreshCw size={12} /> Regenerer IA
            </button>
          )}
          {onManagePrescriptions && (
            <button onClick={onManagePrescriptions} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors flex items-center gap-1">
              <Tag size={12} /> Ordonnances
            </button>
          )}
        </div>
      )}
    </div>
  );
}
