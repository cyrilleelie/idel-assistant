import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { getLogs } from '../../api/admin';

const LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];
const SOURCES = ['all', 'backend', 'frontend'];

const LEVEL_BADGE = {
  DEBUG:    'bg-slate-100 text-slate-500',
  INFO:     'bg-blue-50 text-blue-600',
  WARNING:  'bg-amber-50 text-amber-600',
  ERROR:    'bg-red-50 text-red-600',
  CRITICAL: 'bg-red-100 text-red-800 font-bold',
};

const ROW_BG = {
  DEBUG:    '',
  INFO:     '',
  WARNING:  'bg-amber-50/40',
  ERROR:    'bg-red-50/40',
  CRITICAL: 'bg-red-100/50',
};

const LEVEL_CHIP_ACTIVE = {
  DEBUG:    'bg-slate-100 text-slate-700 ring-1 ring-slate-400',
  INFO:     'bg-blue-50 text-blue-700 ring-1 ring-blue-400',
  WARNING:  'bg-amber-50 text-amber-700 ring-1 ring-amber-400',
  ERROR:    'bg-red-50 text-red-700 ring-1 ring-red-400',
  CRITICAL: 'bg-red-100 text-red-800 ring-1 ring-red-600',
};

export default function LogsTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [minLevel, setMinLevel] = useState('INFO');
  const [source, setSource] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const intervalRef = useRef(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLogs({ level: minLevel, source, limit: 200 });
      setEntries(data.entries ?? []);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Erreur lors de la récupération des logs');
    } finally {
      setLoading(false);
    }
  }, [minLevel, source]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh every 5 s
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 5000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, fetchLogs]);

  const sourceLabel = { all: 'Tout', backend: 'Backend', frontend: 'Frontend' };

  return (
    <div className="space-y-4">

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">

        {/* Level filter */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-slate-500 mr-1">Niveau min :</span>
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setMinLevel(l)}
              className={`px-2 py-1 text-[11px] rounded font-medium transition-colors ${
                minLevel === l
                  ? LEVEL_CHIP_ACTIVE[l]
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Source filter */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-slate-500 mr-1">Source :</span>
          {SOURCES.map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`px-2 py-1 text-[11px] rounded font-medium transition-colors ${
                source === s
                  ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-300'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {sourceLabel[s]}
            </button>
          ))}
        </div>

        {/* Right-side controls */}
        <div className="ml-auto flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-slate-400">
              {lastRefresh.toLocaleTimeString('fr-FR')}
            </span>
          )}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium transition-colors ${
              autoRefresh
                ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <RefreshCw size={12} className={autoRefresh ? 'animate-spin' : ''} />
            {autoRefresh ? 'Auto (5 s)' : 'Auto-refresh'}
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Log table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs font-mono">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left text-slate-500 font-medium whitespace-nowrap w-24">Heure</th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium w-20">Niveau</th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium w-20">Source</th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium w-48">Logger</th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-10 text-center text-slate-400 font-sans text-sm"
                  >
                    {loading ? 'Chargement…' : 'Aucun log trouvé'}
                  </td>
                </tr>
              ) : (
                entries.map((entry, i) => (
                  <tr key={i} className={`${ROW_BG[entry.level] ?? ''} hover:bg-slate-50/70`}>
                    <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleTimeString('fr-FR', {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${LEVEL_BADGE[entry.level] ?? ''}`}
                      >
                        {entry.level}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-500 capitalize whitespace-nowrap">
                      {entry.source}
                    </td>
                    <td
                      className="px-3 py-1.5 text-slate-500 max-w-[12rem] truncate"
                      title={entry.logger}
                    >
                      {entry.logger}
                    </td>
                    <td className="px-3 py-1.5 text-slate-700 whitespace-pre-wrap break-all">
                      {entry.message}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {entries.length > 0 && (
          <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
            {entries.length} entrée{entries.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
