/**
 * PdfViewer — Generates and displays a PDF summary of the patient file.
 *
 * Uses expo-print to generate a printable HTML → PDF.
 * Falls back to a message in Expo Go (native module unavailable).
 */

import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Colors } from '@/constants/colors';
import type { PatientView } from '@/types/patient';
import { formatPatientAge } from '@/types/patient';

interface PdfViewerProps {
  patient: PatientView;
}

/**
 * Build a simple HTML document for the patient summary.
 */
function buildPatientHtml(patient: PatientView): string {
  const age = formatPatientAge(patient.birthDate);
  const badges: string[] = [];
  if (patient.isAld) badges.push('ALD');
  if (patient.hasActiveBsi && patient.bsiLevel) badges.push(patient.bsiLevel);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, sans-serif; padding: 32px; color: #1E293B; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        .subtitle { color: #64748B; font-size: 14px; margin-bottom: 16px; }
        .badge { display: inline-block; background: #FFF7ED; color: #EA580C; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-right: 6px; }
        .badge.bsi { background: #EFF6FF; color: #2563EB; }
        .section { margin-top: 20px; }
        .section-title { font-size: 14px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; }
        .row { margin-bottom: 6px; }
        .label { font-weight: 600; }
        .muted { color: #94A3B8; }
        .footer { margin-top: 32px; border-top: 1px solid #E2E8F0; padding-top: 12px; color: #94A3B8; font-size: 11px; }
      </style>
    </head>
    <body>
      <h1>${patient.displayName}</h1>
      <div class="subtitle">${age ? `${age} — ` : ''}${patient.status === 'active' ? 'Patient actif' : patient.status}</div>
      ${badges.length > 0 ? `<div>${badges.map((b, i) => `<span class="badge${i > 0 ? ' bsi' : ''}">${b}</span>`).join('')}</div>` : ''}

      <div class="section">
        <div class="section-title">Coordonnees</div>
        <div class="row"><span class="label">Adresse :</span> ${patient.address}</div>
        <div class="row"><span class="label">Telephone :</span> ${patient.phone ?? '<span class="muted">Non renseigne</span>'}</div>
        <div class="row"><span class="label">Email :</span> ${patient.email ?? '<span class="muted">Non renseigne</span>'}</div>
        ${patient.birthDate ? `<div class="row"><span class="label">Date de naissance :</span> ${patient.birthDate}</div>` : ''}
      </div>

      ${patient.hasActiveBsi ? `
      <div class="section">
        <div class="section-title">BSI</div>
        <div class="row"><span class="label">Niveau :</span> ${patient.bsiLevel ?? 'N/A'}</div>
        ${patient.bsiEndDate ? `<div class="row"><span class="label">Fin :</span> ${patient.bsiEndDate}</div>` : ''}
      </div>
      ` : ''}

      ${patient.notes ? `
      <div class="section">
        <div class="section-title">Notes</div>
        <div>${patient.notes}</div>
      </div>
      ` : ''}

      <div class="footer">
        Fiche generee le ${new Date().toLocaleDateString('fr-FR')} — IDEL Assistant
      </div>
    </body>
    </html>
  `;
}

export default function PdfViewer({ patient }: PdfViewerProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const isExpoGo = Constants.appOwnership === 'expo';

  const handlePrint = useCallback(async () => {
    if (isExpoGo) {
      Alert.alert(
        'Non disponible',
        "L'export PDF necessite un build natif (EAS Build).",
      );
      return;
    }

    setIsPrinting(true);
    try {
      const Print = await import('expo-print');
      const html = buildPatientHtml(patient);
      await Print.printAsync({ html });
    } catch {
      Alert.alert('Erreur', "Impossible de generer le PDF.");
    } finally {
      setIsPrinting(false);
    }
  }, [patient, isExpoGo]);

  return (
    <Pressable
      onPress={handlePrint}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
      disabled={isPrinting}
    >
      <Ionicons name="print-outline" size={18} color={Colors.primary} />
      <Text style={styles.buttonText}>
        {isPrinting ? 'Generation...' : 'Imprimer la fiche'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryUltraLight,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  pressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});
