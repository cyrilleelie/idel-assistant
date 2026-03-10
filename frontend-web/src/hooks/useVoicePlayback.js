/**
 * Hook de gestion de la lecture audio TTS.
 *
 * Reçoit des chunks MP3 (depuis le WebSocket /agent/voice) et les lit
 * de manière séquentielle via l'AudioContext du navigateur.
 *
 * Gestion de la politique autoplay des navigateurs :
 * L'AudioContext doit être créé/résumé lors d'une interaction utilisateur.
 * Ce hook crée le contexte à la première interaction (playChunk est appelé
 * depuis un handler d'événement → interaction valide).
 *
 * Compatibilité Safari :
 * Safari peut avoir du mal avec les chunks MP3 partiels.
 * On bufferise les chunks avant décodage pour éviter les erreurs de décodage.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const SAFARI_BUFFER_CHUNKS = 2; // Nombre de chunks à bufferiser avant décodage sur Safari

function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export function useVoicePlayback() {
  const audioCtxRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const queueRef = useRef([]); // File d'attente de AudioBuffer
  const isPlayingRef = useRef(false);
  const safariBufferRef = useRef([]); // Buffer de chunks avant décodage (Safari)
  const isMutedRef = useRef(false); // Ref pour accès dans les callbacks

  // Synchronise isMutedRef avec l'état
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Réactive le contexte si suspendu (politique autoplay navigateur)
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  /**
   * Pré-initialise l'AudioContext lors d'un geste utilisateur.
   * Appeler depuis un onClick/onKeyDown pour satisfaire la politique autoplay.
   */
  const warmup = useCallback(() => {
    getAudioContext();
  }, [getAudioContext]);

  const playQueue = useCallback(() => {
    if (queueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);

    const ctx = getAudioContext();
    const buffer = queueRef.current.shift();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      if (!isMutedRef.current) {
        playQueue();
      } else {
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    };
    source.start();
  }, [getAudioContext]);

  /**
   * Ajoute un chunk audio MP3 à la file de lecture.
   * Appelé depuis le WebSocket quand un message {type: "audio_chunk"} est reçu,
   * suivi immédiatement du message binaire.
   *
   * @param {ArrayBuffer} audioData - Données MP3 brutes
   */
  const playChunk = useCallback(async (audioData) => {
    console.log('[useVoicePlayback] playChunk appelé, taille:', audioData.byteLength, 'muted:', isMutedRef.current);
    if (isMutedRef.current) return;

    const ctx = getAudioContext();
    console.log('[useVoicePlayback] AudioContext state:', ctx.state, 'sampleRate:', ctx.sampleRate);

    try {
      let dataToDecode;

      if (isSafari()) {
        // Safari : bufferiser 2 chunks avant de décoder
        safariBufferRef.current.push(audioData);
        if (safariBufferRef.current.length < SAFARI_BUFFER_CHUNKS) return;

        // Concatène les chunks bufferisés
        const totalSize = safariBufferRef.current.reduce((s, b) => s + b.byteLength, 0);
        const combined = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of safariBufferRef.current) {
          combined.set(new Uint8Array(chunk), offset);
          offset += chunk.byteLength;
        }
        safariBufferRef.current = [];
        dataToDecode = combined.buffer;
      } else {
        dataToDecode = audioData;
      }

      const buffer = await ctx.decodeAudioData(dataToDecode);
      console.log('[useVoicePlayback] Audio décodé: durée=%.2fs, channels=%d, sampleRate=%d',
        buffer.duration, buffer.numberOfChannels, buffer.sampleRate);
      queueRef.current.push(buffer);

      if (!isPlayingRef.current) {
        playQueue();
      }
    } catch (err) {
      console.warn('[useVoicePlayback] Décodage audio échoué:', err.message);
      // Affiche les premiers octets pour diagnostic (header WAV/MP3)
      const header = new Uint8Array(audioData.slice(0, 16));
      console.warn('[useVoicePlayback] Header (hex):', Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' '));
    }
  }, [getAudioContext, playQueue]);

  /**
   * Vide la file de lecture et ferme l'AudioContext.
   * Appelé lors de la déconnexion ou quand l'utilisateur clique "Arrêter".
   */
  const stopPlayback = useCallback(() => {
    queueRef.current = [];
    safariBufferRef.current = [];
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
    isPlayingRef.current = false;
    setIsPlaying(false);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => {
      if (!m) {
        // Activation du mute : arrête la lecture en cours
        queueRef.current = [];
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
      return !m;
    });
  }, []);

  // Nettoyage à la destruction du hook
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  return {
    playChunk,
    stopPlayback,
    toggleMute,
    warmup,
    isPlaying,
    isMuted,
  };
}
