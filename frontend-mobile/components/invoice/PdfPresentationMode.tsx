/**
 * PdfPresentationMode — Full-screen PDF viewer for patient presentation.
 *
 * This is the ONLY place in the app where FLAG_SECURE is temporarily
 * disabled. The IDEL physically controls the device and hands it to
 * the patient to view the invoice — screenshot prevention would block
 * legitimate use.
 *
 * Security model:
 * - IDEL is physically present and controlling the device
 * - Screen protection is disabled only while this modal is open
 * - Screen protection is re-enabled immediately on close
 */

import React, { useEffect } from 'react';
import { View, Pressable, Text, StyleSheet, StatusBar, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  enableScreenProtection,
  disableScreenProtection,
} from '@/security/screenProtection';
import { Colors } from '@/constants/colors';

interface PdfPresentationModeProps {
  /** Base64-encoded PDF data (optional — used when real PDF is cached) */
  pdfBase64?: string | null;
  /** Full HTML content to render (fallback when PDF not available) */
  htmlContent?: string | null;
  visible: boolean;
  onClose: () => void;
}

export default function PdfPresentationMode({
  pdfBase64,
  htmlContent: htmlProp,
  visible,
  onClose,
}: PdfPresentationModeProps) {
  // Temporarily disable screen protection for patient viewing
  useEffect(() => {
    if (visible) {
      disableScreenProtection();
    }
    return () => {
      if (visible) {
        enableScreenProtection();
      }
    };
  }, [visible]);

  if (!visible) return null;

  // Use PDF embed if available, otherwise render HTML directly
  const htmlContent = pdfBase64
    ? `<!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=3">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #000; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        embed, iframe, object { width: 100vw; height: 100vh; border: none; }
      </style>
    </head>
    <body>
      <embed src="data:application/pdf;base64,${pdfBase64}" type="application/pdf" width="100%" height="100%">
    </body>
    </html>`
    : htmlProp ?? '';

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <WebView
        source={{ html: htmlContent }}
        style={styles.webview}
        scalesPageToFit
        javaScriptEnabled={false}
        originWhitelist={['*']}
        allowFileAccess
      />

      {/* Close button overlay */}
      <Pressable
        onPress={onClose}
        style={styles.closeButton}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Fermer"
      >
        <View style={styles.closeCircle}>
          <Text style={styles.closeIcon}>{'\u2715'}</Text>
        </View>
        <Text style={styles.closeLabel}>Fermer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    backgroundColor: Colors.black,
  },
  webview: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
  },
  closeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.black,
    lineHeight: 16,
  },
  closeLabel: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
});
