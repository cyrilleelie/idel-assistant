/**
 * Widget de monitoring du secrétaire médical IA.
 * Affiche les stats d'appels du jour : total, RDV créés, urgences.
 * Admin-only, positionné au-dessus de AgentMonitorWidget.
 *
 * Itération F — Secrétaire médical IA.
 */
import { useEffect, useState } from 'react';
import { Phone, PhoneIncoming, AlertTriangle, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { getCallsToday } from '../../api/receptionistService';

/**
 * Ligne d'un appel dans la liste.
 */
function CallRow({ call }) {
  const time = call.created_at
    ? new Date(call.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const durationMin = Math.round((call.duration_seconds || 0) / 60);

  const outcomeIcons = {
    answered: '📞',
    escalated: '🚨',
    voicemail: '📩',
    abandoned: '❌',
  };

  const outcomeLabels = {
    answered: 'Répondu',
    escalated: 'Escaladé',
    voicemail: 'Message',
    abandoned: 'Abandonné',
  };

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-sm">{outcomeIcons[call.outcome] || '📞'}</span>
      <span className="text-xs text-slate-500 w-10">{time}</span>
      <span className="flex-1 text-xs text-slate-700 truncate">
        {outcomeLabels[call.outcome] || call.outcome}
      </span>
      <span className="text-xs text-slate-400">{durationMin}min</span>
      {call.urgency_score >= 2 && (
        <span className="text-xs text-red-500 font-medium">U{call.urgency_score}</span>
      )}
    </div>
  );
}

export default function ReceptionistMonitorWidget() {
  const [data, setData] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeCall, setActiveCall] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      try {
        const result = await getCallsToday();
        if (active) {
          setData(result);
          // Simulation : un appel "actif" si le dernier appel est < 5 min
          if (result.calls?.length > 0) {
            const lastCall = new Date(result.calls[0].created_at);
            const now = new Date();
            setActiveCall((now - lastCall) < 300_000);
          }
        }
      } catch {
        // Silencieux — widget informatif
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (!data) return null;

  const { stats, calls } = data;
  const hasUrgencies = (stats?.escalated || 0) > 0;

  return (
    <div className="fixed bottom-32 right-4 z-40">
      {/* Badge compact */}
      <button
        onClick={() => setIsExpanded((e) => !e)}
        className={`
          flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
          shadow-sm border transition-colors cursor-pointer select-none
          ${activeCall
            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
            : hasUrgencies
              ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
              : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
          }
        `}
      >
        {activeCall && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        )}
        <Phone className="w-3 h-3" />
        {stats?.total || 0}
        {hasUrgencies && (
          <span className="text-red-600 font-bold ml-0.5">
            {stats.escalated}
          </span>
        )}
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>

      {/* Panel détaillé */}
      {isExpanded && (
        <div className="absolute bottom-8 right-0 w-72 bg-white border rounded-xl shadow-xl p-4 text-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-1.5">
              <PhoneIncoming className="w-4 h-4 text-purple-500" />
              Appels du jour
            </h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-slate-400 hover:text-slate-600 text-sm"
            >
              &times;
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center">
              <div className="text-lg font-bold text-slate-800">{stats?.total || 0}</div>
              <div className="text-xs text-slate-500">Appels</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{stats?.rdv_created || 0}</div>
              <div className="text-xs text-slate-500 flex items-center justify-center gap-0.5">
                <Calendar className="w-3 h-3" /> RDV
              </div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-bold ${hasUrgencies ? 'text-red-600' : 'text-slate-400'}`}>
                {stats?.escalated || 0}
              </div>
              <div className="text-xs text-slate-500 flex items-center justify-center gap-0.5">
                <AlertTriangle className="w-3 h-3" /> Urgences
              </div>
            </div>
          </div>

          {/* Durée moyenne */}
          {stats?.avg_duration_seconds > 0 && (
            <div className="text-xs text-slate-400 text-center mb-3">
              Durée moyenne : {Math.round(stats.avg_duration_seconds / 60)} min
            </div>
          )}

          {/* Liste des 10 derniers appels */}
          {calls && calls.length > 0 ? (
            <div className="border-t pt-2 max-h-48 overflow-y-auto">
              {calls.slice(0, 10).map((call) => (
                <CallRow key={call.id} call={call} />
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-400 text-center py-4 border-t">
              Aucun appel aujourd'hui
            </div>
          )}
        </div>
      )}
    </div>
  );
}
