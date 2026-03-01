/**
 * Bouton microphone push-to-talk pour la saisie vocale.
 *
 * Mode : maintenir le bouton → enregistrement → relâcher → transcription REST.
 * La transcription est insérée dans le ChatInput pour relecture avant envoi.
 *
 * Itération C : provider cloud (OpenAI Whisper).
 * Itération D : provider local (faster-whisper self-hosted, sans changement d'interface).
 */
import { useEffect, useRef, useState } from 'react';
import { Mic, Loader2 } from 'lucide-react';

const TRANSCRIBE_URL = '/api/v1/agent/transcribe';

function getAuthToken() {
  return localStorage.getItem('access_token') || '';
}

/**
 * Indicateur d'enregistrement affiché au-dessus du bouton.
 * Affiche la durée écoulée pour donner un retour visuel que le micro capte.
 */
function RecordingIndicator() {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
                  bg-red-500 text-white text-xs px-2 py-1 rounded-full
                  whitespace-nowrap shadow-md z-10 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      🔴 {duration}s — Relâche pour envoyer
    </div>
  );
}

/**
 * @param {{
 *   onTranscript: (text: string) => void,
 *   onWarning?: (msg: string) => void,
 *   onError?: (msg: string) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function VoiceInput({ onTranscript, onWarning, onError, disabled = false }) {
  const [state, setState] = useState('idle'); // 'idle' | 'recording' | 'processing'
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const handleError = (msg) => {
    setState('idle');
    if (onError) onError(msg);
  };

  const startRecording = async () => {
    if (disabled || state !== 'idle') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,       // Optimal pour Whisper
          echoCancellation: true,
          noiseSuppression: true,  // Réduit le bruit de fond bureau
        },
      });
      streamRef.current = stream;

      // webm/opus est le format natif MediaRecorder sur Chrome/Firefox
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Arrête le micro
        streamRef.current?.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunksRef.current, { type: mimeType });

        if (blob.size < 500) {
          // Audio trop court → probablement un clic accidentel
          setState('idle');
          return;
        }

        setState('processing');

        try {
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');

          const token = getAuthToken();
          const response = await fetch(TRANSCRIBE_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.detail || `Erreur ${response.status}`);
          }

          const data = await response.json();

          if (data.text && data.text.trim()) {
            onTranscript(data.text.trim());
          }

          // Avertissement RGPD si provider non-local
          if (data.warning && onWarning) {
            onWarning(data.warning);
          }
        } catch (err) {
          console.error('[VoiceInput] Transcription failed:', err);
          handleError(`Transcription échouée — ${err.message || 'réessaie'}`);
          return;
        }

        setState('idle');
      };

      recorder.start(100); // Collecte des chunks toutes les 100ms
      mediaRecorderRef.current = recorder;
      setState('recording');
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        handleError('Accès au microphone refusé — vérifie les permissions du navigateur');
      } else if (err.name === 'NotFoundError') {
        handleError('Aucun microphone détecté');
      } else {
        handleError("Impossible d'accéder au microphone");
      }
    }
  };

  const stopRecording = () => {
    if (state === 'recording' && mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      // setState('processing') est géré dans onstop
    }
  };

  // Nettoyage si le composant est démonté pendant un enregistrement
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const isProcessing = state === 'processing';
  const isRecording = state === 'recording';
  const isDisabled = disabled || isProcessing;

  return (
    <div className="relative flex-shrink-0">
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
        onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
        onMouseLeave={stopRecording} // Si le curseur quitte le bouton pendant l'enregistrement
        disabled={isDisabled}
        aria-label={
          isRecording ? 'Enregistrement en cours — relâche pour transcrire'
          : isProcessing ? 'Transcription en cours...'
          : 'Maintiens pour dicter (push-to-talk)'
        }
        className={`
          w-9 h-9 rounded-xl flex items-center justify-center
          transition-all duration-150 select-none touch-none
          ${isRecording
            ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-200 animate-pulse'
            : isProcessing
            ? 'bg-amber-400 text-white cursor-wait'
            : isDisabled
            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 active:bg-gray-300'
          }
        `}
      >
        {isProcessing
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Mic className="w-4 h-4" />
        }
      </button>

      {isRecording && <RecordingIndicator />}
    </div>
  );
}
