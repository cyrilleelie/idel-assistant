/**
 * DailySynthesis — Collapsible daily summary with voice readout.
 *
 * Shows a text synthesis of all patients for the day with alerts highlighted.
 * A play button triggers TTS (expo-speech) to read the synthesis aloud.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import type { PreparationData } from '@/services/preparationService';
import { buildDailySynthesisSections } from '@/services/preparationService';
import type { SynthesisSection } from '@/services/preparationService';
import { Colors } from '@/constants/colors';

interface DailySynthesisProps {
  data: PreparationData;
}

/**
 * Pick the best available French voice for TTS.
 * Prefers enhanced/premium voices, falls back to any fr-FR voice.
 */
async function pickFrenchVoice(): Promise<string | undefined> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const frVoices = voices.filter((v) => v.language.startsWith('fr'));
    if (frVoices.length === 0) return undefined;
    // Prefer enhanced/premium voices (identified by quality or name hints)
    const enhanced = frVoices.find(
      (v) =>
        v.quality === 'Enhanced' ||
        v.name?.toLowerCase().includes('enhanced') ||
        v.name?.toLowerCase().includes('premium') ||
        v.name?.toLowerCase().includes('amelie'),
    );
    return enhanced?.identifier ?? frVoices[0]?.identifier;
  } catch {
    return undefined;
  }
}

export default function DailySynthesis({ data }: DailySynthesisProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSection, setCurrentSection] = useState('');
  const stoppedRef = useRef(false);
  const voiceIdRef = useRef<string | undefined>(undefined);
  const voiceLoadedRef = useRef(false);

  const allAlerts: { patientName: string; alert: string }[] = [];
  for (const p of data.patients) {
    if (p.aiSummary) {
      for (const alert of p.aiSummary.alerts) {
        allAlerts.push({ patientName: p.patientName, alert });
      }
    }
  }

  // Build summary parts for display
  const patientsWithInfo = data.patients.filter((p) => p.hasNewInfo);
  const patientsWithoutInfo = data.patients.filter((p) => !p.hasNewInfo);

  // Pre-load best French voice on mount
  useEffect(() => {
    if (!voiceLoadedRef.current) {
      voiceLoadedRef.current = true;
      pickFrenchVoice().then((id) => {
        voiceIdRef.current = id;
      });
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      Speech.stop();
    };
  }, []);

  /**
   * Speak a single section and return a promise that resolves when done.
   */
  const speakSection = useCallback(
    (section: SynthesisSection): Promise<void> => {
      return new Promise((resolve) => {
        setCurrentSection(section.label);

        const opts: Speech.SpeechOptions = {
          language: 'fr-FR',
          rate: 0.92,
          pitch: 1.02,
          onDone: resolve,
          onStopped: resolve,
          onError: () => resolve(),
        };

        if (voiceIdRef.current) {
          opts.voice = voiceIdRef.current;
        }

        Speech.speak(section.text, opts);
      });
    },
    [],
  );

  /**
   * Sequential playback: speak each section with a short pause between them.
   */
  const handleToggleSpeech = useCallback(async () => {
    if (isSpeaking) {
      stoppedRef.current = true;
      Speech.stop();
      setIsSpeaking(false);
      setCurrentSection('');
      return;
    }

    const sections = buildDailySynthesisSections(data);
    stoppedRef.current = false;
    setIsSpeaking(true);

    for (const section of sections) {
      if (stoppedRef.current) break;
      await speakSection(section);
      // Short pause between sections (600ms) for natural rhythm
      if (!stoppedRef.current) {
        await new Promise<void>((r) => setTimeout(r, 600));
      }
    }

    if (!stoppedRef.current) {
      setIsSpeaking(false);
      setCurrentSection('');
    }
  }, [data, isSpeaking, speakSection]);

  return (
    <View style={styles.container}>
      {/* Header with play button */}
      <View style={styles.header}>
        <Pressable
          onPress={handleToggleSpeech}
          style={({ pressed }) => [
            styles.playBtn,
            isSpeaking && styles.playBtnActive,
            pressed && styles.playBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={isSpeaking ? 'Arreter la lecture' : 'Ecouter le resume'}
        >
          <Ionicons
            name={isSpeaking ? 'stop' : 'volume-high-outline'}
            size={18}
            color={isSpeaking ? Colors.white : Colors.primary}
          />
        </Pressable>

        <Pressable
          onPress={() => setIsExpanded((prev) => !prev)}
          style={styles.headerTextArea}
        >
          <Text style={styles.title}>Resume de la journee</Text>
          <Text style={styles.subtitle}>
            {isSpeaking && currentSection ? (
              <Text style={styles.speakingLabel}>{currentSection}...</Text>
            ) : (
              <>
                {data.totalPatients} patient{data.totalPatients > 1 ? 's' : ''}
                {allAlerts.length > 0 && (
                  <Text style={styles.alertCount}>
                    {' \u00B7 '}{allAlerts.length} alerte{allAlerts.length > 1 ? 's' : ''}
                  </Text>
                )}
              </>
            )}
          </Text>
        </Pressable>

        <Pressable onPress={() => setIsExpanded((prev) => !prev)} hitSlop={8}>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={Colors.textSecondary}
          />
        </Pressable>
      </View>

      {/* Expanded content */}
      {isExpanded && (
        <View style={styles.content}>
          {/* Alerts section */}
          {allAlerts.length > 0 && (
            <View style={styles.alertsSection}>
              <Text style={styles.sectionLabel}>Points de vigilance</Text>
              {allAlerts.map((a, idx) => (
                <View key={idx} style={styles.alertRow}>
                  <Text style={styles.alertIcon}>&#9888;&#65039;</Text>
                  <Text style={styles.alertText}>
                    <Text style={styles.alertPatient}>{a.patientName}</Text>
                    {' : '}
                    {a.alert}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Patients with new info */}
          {patientsWithInfo.length > 0 && (
            <View style={styles.infoSection}>
              <Text style={styles.sectionLabel}>
                Nouvelles informations ({patientsWithInfo.length})
              </Text>
              {patientsWithInfo.map((p) => (
                <View key={p.patientId} style={styles.patientBlock}>
                  <View style={styles.patientRow}>
                    <Text style={styles.patientTime}>{p.appointmentTime}</Text>
                    <Text style={styles.patientName}>
                      {p.patientName}
                      <Text style={styles.patientCare}> — {p.careTypes.join(' + ')}</Text>
                    </Text>
                  </View>
                  {p.transmissionsSinceLastVisit.map((tx) => (
                    <View key={tx.id} style={styles.txBlock}>
                      <Text style={styles.txAuthor}>
                        {tx.authorName} ({tx.date})
                      </Text>
                      {tx.contentStructured ? (
                        <>
                          {Boolean(tx.contentStructured.synthese) && (
                            <Text style={styles.patientSummary}>{tx.contentStructured.synthese}</Text>
                          )}
                          {Boolean(tx.contentStructured.soins) && (
                            <Text style={styles.txDetail}>Soins : {tx.contentStructured.soins}</Text>
                          )}
                          {Boolean(tx.contentStructured.constantes) && (
                            <Text style={styles.txDetail}>Constantes : {tx.contentStructured.constantes}</Text>
                          )}
                          {Boolean(tx.contentStructured.observations) && (
                            <Text style={styles.txDetail}>Observations : {tx.contentStructured.observations}</Text>
                          )}
                          {Boolean(tx.contentStructured.actions) && (
                            <Text style={styles.txDetail}>Actions : {tx.contentStructured.actions}</Text>
                          )}
                        </>
                      ) : tx.contentText ? (
                        <Text style={styles.patientSummary}>{tx.contentText}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* Patients without new info */}
          {patientsWithoutInfo.length > 0 && (
            <View style={styles.infoSection}>
              <Text style={styles.sectionLabel}>
                Aucune nouvelle ({patientsWithoutInfo.length})
              </Text>
              <Text style={styles.noInfoNames}>
                {patientsWithoutInfo.map((p) => p.patientName).join(', ')}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryUltraLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnActive: {
    backgroundColor: Colors.primary,
  },
  playBtnPressed: {
    opacity: 0.8,
  },
  headerTextArea: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  alertCount: {
    color: Colors.warning,
    fontWeight: '600',
  },
  speakingLabel: {
    color: Colors.primary,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  // Expanded content
  content: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    padding: 14,
    gap: 14,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  // Alerts
  alertsSection: {
    backgroundColor: Colors.warningLight,
    borderRadius: 8,
    padding: 10,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  alertIcon: {
    fontSize: 13,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  alertPatient: {
    fontWeight: '700',
    color: Colors.warning,
  },
  // Patient rows
  infoSection: {},
  patientBlock: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  patientRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  patientTime: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
    minWidth: 40,
    marginTop: 1,
  },
  patientName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  patientCare: {
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  txBlock: {
    marginLeft: 50,
    marginBottom: 6,
  },
  txAuthor: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  patientSummary: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 17,
  },
  txDetail: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginTop: 1,
  },
  noInfoNames: {
    fontSize: 13,
    color: Colors.textTertiary,
    lineHeight: 19,
  },
});
