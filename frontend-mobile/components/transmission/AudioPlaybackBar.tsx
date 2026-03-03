/**
 * AudioPlaybackBar — Play/pause bar for encrypted audio files.
 *
 * Shows a play/pause button, progress bar, and duration in MM:SS.
 * Handles decryption-to-temp-file, playback status updates, and cleanup.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import type { AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import {
  playEncryptedAudio,
  stopPlayback,
  formatDuration,
  type PlaybackHandle,
} from '@/services/audioService';
import { Colors } from '@/constants/colors';

interface AudioPlaybackBarProps {
  encryptedPath: string;
  durationMs: number;
  onPlaybackEnd?: () => void;
}

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export default function AudioPlaybackBar({
  encryptedPath,
  durationMs,
  onPlaybackEnd,
}: AudioPlaybackBarProps) {
  const [state, setState] = useState<PlaybackState>('idle');
  const [positionMs, setPositionMs] = useState(0);
  const handleRef = useRef<PlaybackHandle | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (handleRef.current) {
        stopPlayback(handleRef.current).catch(() => {});
        handleRef.current = null;
      }
    };
  }, []);

  // Update progress bar animation
  useEffect(() => {
    const progress = durationMs > 0 ? positionMs / durationMs : 0;
    Animated.timing(progressAnim, {
      toValue: Math.min(progress, 1),
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [positionMs, durationMs, progressAnim]);

  const handlePlay = useCallback(async () => {
    if (state === 'loading') return;

    // If paused, resume
    if (state === 'paused' && handleRef.current) {
      try {
        await handleRef.current.sound.playAsync();
        setState('playing');
      } catch {
        setState('error');
      }
      return;
    }

    // Start new playback
    setState('loading');
    try {
      // Cleanup any previous playback
      if (handleRef.current) {
        await stopPlayback(handleRef.current);
        handleRef.current = null;
      }

      const handle = await playEncryptedAudio(encryptedPath);
      handleRef.current = handle;

      // Set up status listener
      handle.sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;
        setPositionMs(status.positionMillis);

        if (status.didJustFinish) {
          setState('idle');
          setPositionMs(0);
          onPlaybackEnd?.();
        }
      });

      await handle.sound.playAsync();
      setState('playing');
    } catch {
      setState('error');
    }
  }, [state, encryptedPath, onPlaybackEnd]);

  const handlePause = useCallback(async () => {
    if (handleRef.current && state === 'playing') {
      try {
        await handleRef.current.sound.pauseAsync();
        setState('paused');
      } catch {
        // Ignore
      }
    }
  }, [state]);

  const handleStop = useCallback(async () => {
    if (handleRef.current) {
      await stopPlayback(handleRef.current);
      handleRef.current = null;
    }
    setState('idle');
    setPositionMs(0);
  }, []);

  const isPlaying = state === 'playing';
  const isActive = isPlaying || state === 'paused';

  if (state === 'error') {
    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle-outline" size={20} color={Colors.error} />
        <Text style={styles.errorText}>Audio non disponible</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        onPress={isPlaying ? handlePause : handlePlay}
        style={({ pressed }) => [styles.playBtn, pressed && styles.playBtnPressed]}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause' : 'Ecouter'}
        disabled={state === 'loading'}
      >
        {state === 'loading' ? (
          <Ionicons name="hourglass-outline" size={20} color={Colors.primary} />
        ) : (
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={20}
            color={Colors.primary}
          />
        )}
      </Pressable>

      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </View>

      <Text style={styles.duration}>
        {isActive ? formatDuration(positionMs) : formatDuration(durationMs)}
      </Text>

      {isActive && (
        <Pressable
          onPress={handleStop}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Arreter"
        >
          <Ionicons name="stop" size={18} color={Colors.textTertiary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnPressed: {
    opacity: 0.7,
  },
  progressContainer: {
    flex: 1,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  duration: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    minWidth: 40,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    fontStyle: 'italic',
  },
});
