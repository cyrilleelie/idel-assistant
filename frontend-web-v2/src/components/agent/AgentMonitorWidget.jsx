/**
 * Widget de monitoring admin pour l'agent IA.
 * Affiche le statut des providers (cloud/GPU), les métriques de latence
 * et la conformité HDS. Visible uniquement pour les admins du cabinet.
 *
 * Itération D — Migration GPU.
 */
import { useEffect, useState } from 'react';
import { getAgentHealth } from '../../api/agentService';

/**
 * Ligne de statut d'un provider (LLM/STT/TTS).
 */
function ProviderRow({ label, name, isLocal, healthy }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 w-8 text-xs font-medium">{label}</span>
      <span className="flex-1 text-gray-700 text-xs truncate mx-2">{name}</span>
      <div className="flex items-center gap-1">
        {isLocal ? (
          <span className="text-blue-500 text-xs">local</span>
        ) : (
          <span className="text-gray-400 text-xs">cloud</span>
        )}
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            healthy ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
      </div>
    </div>
  );
}

/**
 * Ligne de métrique de latence.
 */
function MetricRow({ label, value, p95, goodThreshold, unit, highlight = false }) {
  const isGood = value !== null && value <= goodThreshold;
  return (
    <div className={`flex items-center justify-between ${highlight ? 'font-medium' : ''}`}>
      <span className="text-gray-500 text-xs">{label}</span>
      <div className="text-right">
        {value !== null ? (
          <span className={`text-xs ${isGood ? 'text-green-600' : 'text-amber-600'}`}>
            {Math.round(value)}
            {unit}
            {p95 != null && (
              <span className="text-gray-400 ml-1">
                p95:{Math.round(p95)}
              </span>
            )}
          </span>
        ) : (
          <span className="text-gray-300 text-xs">&mdash;</span>
        )}
      </div>
    </div>
  );
}

export default function AgentMonitorWidget() {
  const [health, setHealth] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchHealth = async () => {
      try {
        const data = await getAgentHealth();
        if (active) setHealth(data);
      } catch {
        // Silencieux — le widget est informatif
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (!health) return null;

  const providers = health.providers || {};
  const metrics = health.metrics || {};
  const llm = providers.llm || {};
  const stt = providers.stt || {};
  const tts = providers.tts || {};

  const isOk = health.status === 'ok';

  return (
    <div className="fixed bottom-20 right-4 z-40">
      {/* Badge compact */}
      <button
        onClick={() => setIsExpanded((e) => !e)}
        className={`
          flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
          shadow-sm border transition-colors cursor-pointer select-none
          ${
            isOk
              ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
              : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
          }
        `}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isOk ? 'bg-green-500' : 'bg-amber-500 animate-pulse'
          }`}
        />
        Agent {llm.is_local ? 'GPU' : 'Cloud'}
        {health.hds_compliant && (
          <span className="text-blue-600 font-semibold ml-0.5">HDS</span>
        )}
      </button>

      {/* Panel détaillé */}
      {isExpanded && (
        <div className="absolute bottom-8 right-0 w-72 bg-white border rounded-xl shadow-xl p-4 text-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Statut de l'agent</h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              &times;
            </button>
          </div>

          {/* Providers */}
          <div className="space-y-1.5 mb-3">
            <ProviderRow
              label="LLM"
              name={
                llm.is_local
                  ? `vLLM \u00B7 ${llm.model || ''}`
                  : 'Mistral API'
              }
              isLocal={llm.is_local}
              healthy={llm.healthy}
            />
            <ProviderRow
              label="STT"
              name={stt.is_local ? 'faster-whisper' : 'Whisper API'}
              isLocal={stt.is_local}
              healthy={stt.healthy}
            />
            <ProviderRow
              label="TTS"
              name={tts.is_local ? 'Kokoro' : tts.name === 'disabled' ? 'Disabled' : 'ElevenLabs'}
              isLocal={tts.is_local}
              healthy={tts.healthy}
            />
          </div>

          {/* Latence */}
          <div className="border-t pt-3 space-y-1">
            <MetricRow
              label="1er token LLM"
              value={metrics.ttft_ms?.mean ?? null}
              p95={metrics.ttft_ms?.p95 ?? null}
              goodThreshold={200}
              unit="ms"
            />
            <MetricRow
              label="Transcription"
              value={metrics.stt_latency_ms?.mean ?? null}
              p95={metrics.stt_latency_ms?.p95 ?? null}
              goodThreshold={500}
              unit="ms"
            />
            <MetricRow
              label="TTS premier son"
              value={metrics.tts_ttfb_ms?.mean ?? null}
              p95={metrics.tts_ttfb_ms?.p95 ?? null}
              goodThreshold={100}
              unit="ms"
            />
            <MetricRow
              label="Voix \u2192 r\u00E9ponse"
              value={metrics.voice_to_voice_ms?.mean ?? null}
              p95={metrics.voice_to_voice_ms?.p95 ?? null}
              goodThreshold={800}
              unit="ms"
              highlight
            />
          </div>

          {/* Activité du jour */}
          <div className="border-t pt-3 mt-3 flex justify-between text-xs text-gray-500">
            <span>Sessions : {metrics.sessions_today ?? 0}</span>
            <span>Actions : {metrics.actions_today ?? 0}</span>
          </div>

          {/* Badge HDS */}
          {health.hds_compliant ? (
            <div className="mt-3 text-xs text-center text-blue-600 font-medium bg-blue-50 rounded-lg py-1.5">
              Traitement 100% local &middot; Conforme HDS
            </div>
          ) : (
            <div className="mt-3 text-xs text-center text-amber-600 bg-amber-50 rounded-lg py-1.5">
              Services cloud actifs &middot; Migration GPU en cours
            </div>
          )}
        </div>
      )}
    </div>
  );
}
