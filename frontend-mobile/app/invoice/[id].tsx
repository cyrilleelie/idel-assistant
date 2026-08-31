/**
 * InvoiceDetailScreen — Full invoice view with PDF, send, and presentation.
 *
 * Routes: /invoice/{id} (WatermelonDB ID)
 *         /invoice/{id}?appointmentId={appointmentId} (lookup by appointment)
 *
 * Security: FLAG_SECURE active (financial + patient data).
 * Audit: view_invoice, send_invoice.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAudit } from '@/hooks/useAudit';
import { useScreenProtection } from '@/security/screenProtection';
import { api } from '@/services/api';
import {
  getInvoiceById,
  getInvoiceForAppointment,
  downloadAndCachePdf,
  getCachedPdfPath,
  decryptCachedPdf,
  sendInvoice,
  generateInvoiceHtml,
} from '@/services/invoiceService';
import type { InvoiceDetail } from '@/services/invoiceService';
import InvoiceSendModal from '@/components/invoice/InvoiceSendModal';
import VitaleStatusBadge from '@/components/invoice/VitaleStatusBadge';
import PdfPresentationMode from '@/components/invoice/PdfPresentationMode';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { useToastStore } from '@/stores/toastStore';
import { formatAmount, formatInvoiceNumber } from '@/utils/formatters';
import { formatDateFrench } from '@/utils/dateHelpers';
import { Colors } from '@/constants/colors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

function invoiceStatusLabel(status: string): string {
  switch (status) {
    case 'validated':
      return 'PAYE';
    case 'draft':
      return 'BROUILLON';
    case 'cancelled':
      return 'ANNULEE';
    case 'transmitted':
      return 'TRANSMISE';
    default:
      return status.toUpperCase();
  }
}

function invoiceStatusBgColor(status: string): string {
  switch (status) {
    case 'validated':
      return `${Colors.primary}15`;
    case 'draft':
      return '#FEF3C7';
    case 'cancelled':
      return Colors.errorLight;
    default:
      return Colors.borderLight;
  }
}

function invoiceStatusTextColor(status: string): string {
  switch (status) {
    case 'validated':
      return Colors.primary;
    case 'draft':
      return '#D97706';
    case 'cancelled':
      return Colors.error;
    default:
      return Colors.textSecondary;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InvoiceDetailScreen() {
  const { id, appointmentId } = useLocalSearchParams<{
    id: string;
    appointmentId?: string;
  }>();
  const router = useRouter();
  const database = useDatabase();
  const { isOnline } = useOnlineStatus();
  const { logAccess } = useAudit();
  const showToast = useToastStore((s) => s.showToast);

  useScreenProtection();

  // -- State --

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [invoiceHtml, setInvoiceHtml] = useState<string | null>(null);
  const [showPresentation, setShowPresentation] = useState(false);

  const [sendChannel, setSendChannel] = useState<'email' | 'sms'>('email');
  const [showSendModal, setShowSendModal] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // -- Load invoice --

  const loadInvoice = useCallback(async () => {
    setIsLoading(true);
    setNotFound(false);

    const apiClient = isOnline ? api : null;

    let result: InvoiceDetail | null = null;

    if (appointmentId) {
      result = await getInvoiceForAppointment(database, apiClient, appointmentId);
    } else if (id && id !== '[id]') {
      result = await getInvoiceById(database, apiClient, id);
    }

    if (result) {
      setInvoice(result);
      logAccess('view_invoice', 'invoice', result.serverId);
    } else {
      setNotFound(true);
    }

    setIsLoading(false);
  }, [id, appointmentId, database, isOnline, logAccess]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  // -- PDF / HTML display --

  const loadDisplayContent = useCallback(async (): Promise<boolean> => {
    if (!invoice) return false;

    if (pdfBase64 || invoiceHtml) return true;

    const cached = await getCachedPdfPath(database, invoice.id);
    if (cached) {
      try {
        const b64 = await decryptCachedPdf(cached);
        setPdfBase64(b64);
        return true;
      } catch {
        // Cache corrupted
      }
    }

    if (isOnline && invoice.serverId) {
      setIsPdfLoading(true);
      try {
        const path = await downloadAndCachePdf(
          database,
          api,
          invoice.id,
          invoice.serverId,
        );
        const b64 = await decryptCachedPdf(path);
        setPdfBase64(b64);
        return true;
      } catch {
        // Download failed
      } finally {
        setIsPdfLoading(false);
      }
    }

    const html = generateInvoiceHtml(invoice);
    setInvoiceHtml(html);
    return true;
  }, [invoice, pdfBase64, invoiceHtml, database, isOnline]);

  const handleViewPdf = useCallback(async () => {
    const ready = await loadDisplayContent();
    if (ready) {
      setShowPresentation(true);
    }
  }, [loadDisplayContent]);

  const handlePresent = useCallback(async () => {
    const ready = await loadDisplayContent();
    if (ready) {
      setShowPresentation(true);
    }
  }, [loadDisplayContent]);

  // -- Send actions --

  const handleOpenSend = useCallback((channel: 'email' | 'sms') => {
    setSendChannel(channel);
    setShowSendModal(true);
  }, []);

  const handleSend = useCallback(
    async (recipient: string) => {
      if (!invoice) return;
      setIsSending(true);

      try {
        const apiClient = isOnline ? api : null;
        await sendInvoice(apiClient, invoice.serverId, sendChannel, recipient);

        logAccess('send_invoice', 'invoice', invoice.serverId, {
          channel: sendChannel,
        });

        const channelLabel = sendChannel === 'email' ? 'Email' : 'SMS';
        if (isOnline) {
          showToast(`${channelLabel} envoye`, 'success');
        } else {
          showToast("L'envoi sera effectue au retour du reseau", 'info');
        }
      } catch {
        showToast("Erreur lors de l'envoi", 'error');
      } finally {
        setIsSending(false);
        setShowSendModal(false);
      }
    },
    [invoice, isOnline, sendChannel, logAccess, showToast],
  );

  // -- Computed values --

  const formattedDate = useMemo(() => {
    if (!invoice?.date) return '';
    return formatDateFrench(invoice.date);
  }, [invoice?.date]);

  // -- Loading / not found states --

  if (isLoading) {
    return <LoadingScreen message="Chargement de la facture..." />;
  }

  if (notFound || !invoice) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Facture',
            headerStyle: styles.headerBar,
            headerTitleStyle: styles.headerTitle,
            headerTintColor: Colors.text,
          }}
        />
        <View style={styles.notFoundContainer}>
          <Ionicons name="document-text-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.notFoundTitle}>Facture en cours de generation</Text>
          <Text style={styles.notFoundText}>
            La facture sera disponible dans quelques instants apres la synchronisation.
          </Text>
          <TouchableOpacity onPress={loadInvoice} style={styles.retryButton}>
            <Ionicons name="refresh-outline" size={18} color={Colors.primary} />
            <Text style={styles.retryText}>Reessayer</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  // -- Render --

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerStyle: styles.headerBar,
          headerTitleStyle: styles.headerTitle,
          headerTintColor: Colors.text,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerBackBtn}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
          ),
          headerTitle: () => (
            <View style={styles.headerTitleArea}>
              <Text style={styles.headerTitleMain}>
                Facture {formatInvoiceNumber(invoice.invoiceNumber)}
              </Text>
              <Text style={styles.headerTitleSub}>{formattedDate}</Text>
            </View>
          ),
          headerRight: () => (
            <View style={[
              styles.statusBadge,
              { backgroundColor: invoiceStatusBgColor(invoice.status) },
            ]}>
              <Text style={[
                styles.statusBadgeText,
                { color: invoiceStatusTextColor(invoice.status) },
              ]}>
                {invoiceStatusLabel(invoice.status)}
              </Text>
            </View>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero section: amount */}
        <View style={styles.heroSection}>
          <Text style={styles.heroLabel}>Montant Total</Text>
          <Text style={styles.heroAmount}>{formatAmount(invoice.totalAmount)}</Text>
          <View style={styles.heroPatientBadge}>
            <Ionicons name="person-outline" size={14} color={Colors.primary} />
            <Text style={styles.heroPatientName}>{invoice.patientName}</Text>
          </View>
        </View>

        {/* Detail des actes */}
        <Text style={styles.sectionTitle}>DETAIL DES ACTES</Text>
        <View style={styles.actsCard}>
          {/* Table header */}
          <View style={styles.actsHeader}>
            <Text style={[styles.actsHeaderCell, styles.actsHeaderActe]}>ACTE</Text>
            <Text style={[styles.actsHeaderCell, styles.actsHeaderQte]}>QTE</Text>
            <Text style={[styles.actsHeaderCell, styles.actsHeaderMontant]}>MONTANT</Text>
          </View>
          {/* Table rows */}
          {invoice.acts.map((act, idx) => (
            <View
              key={idx}
              style={[
                styles.actsRow,
                idx === invoice.acts.length - 1 && styles.actsRowLast,
              ]}
            >
              <View style={styles.actsActeCol}>
                <Text style={styles.actsCode}>{act.code}</Text>
                {act.label ? (
                  <Text style={styles.actsLabel}>{act.label}</Text>
                ) : null}
              </View>
              <Text style={styles.actsQte}>{act.quantity ?? 1}</Text>
              <Text style={styles.actsMontant}>{formatAmount(act.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Financial summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Hors Taxes</Text>
            <Text style={styles.summaryValue}>{formatAmount(invoice.totalAmount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>TVA</Text>
            <Text style={styles.summaryValue}>0,00 EUR</Text>
          </View>
          <View style={styles.summarySeparator} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total a payer</Text>
            <Text style={styles.summaryTotalValue}>{formatAmount(invoice.totalAmount)}</Text>
          </View>
        </View>

        {/* AMO / AMC breakdown if available */}
        {(invoice.amountAmo > 0 || invoice.amountAmc > 0) && (
          <View style={styles.breakdownCard}>
            {invoice.amountAmo > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Part AMO</Text>
                <Text style={styles.breakdownValue}>{formatAmount(invoice.amountAmo)}</Text>
              </View>
            )}
            {invoice.amountAmc > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Part AMC</Text>
                <Text style={styles.breakdownValue}>{formatAmount(invoice.amountAmc)}</Text>
              </View>
            )}
            {invoice.amountPatient > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Part patient</Text>
                <Text style={styles.breakdownValue}>{formatAmount(invoice.amountPatient)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Carte Vitale badge */}
        <View style={styles.vitaleBadgeRow}>
          <VitaleStatusBadge status={invoice.vitaleStatus} />
        </View>

        {/* Action buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={handleViewPdf}
            style={styles.actionBtnSecondary}
            activeOpacity={0.75}
            disabled={isPdfLoading}
          >
            {isPdfLoading ? (
              <ActivityIndicator size="small" color={Colors.text} />
            ) : (
              <Ionicons name="document-text-outline" size={20} color={Colors.text} />
            )}
            <Text style={styles.actionBtnSecondaryText}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleOpenSend('email')}
            style={styles.actionBtnPrimary}
            activeOpacity={0.75}
          >
            <Ionicons name="send-outline" size={20} color={Colors.white} />
            <Text style={styles.actionBtnPrimaryText}>Envoyer</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Send modal */}
      <InvoiceSendModal
        visible={showSendModal}
        channel={sendChannel}
        defaultRecipient={
          sendChannel === 'email'
            ? invoice.patientEmail ?? ''
            : invoice.patientPhone ?? ''
        }
        invoiceNumber={invoice.invoiceNumber}
        patientName={invoice.patientName}
        onSend={handleSend}
        onCancel={() => setShowSendModal(false)}
        isSending={isSending}
      />

      {/* Presentation mode */}
      <PdfPresentationMode
        pdfBase64={pdfBase64}
        htmlContent={invoiceHtml}
        visible={showPresentation}
        onClose={() => setShowPresentation(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  headerBar: {
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleArea: {
    alignItems: 'center',
    gap: 1,
  },
  headerTitleMain: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  headerTitleSub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  heroLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  heroAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },
  heroPatientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryUltraLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  heroPatientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Sections
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Acts table
  actsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  actsHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actsHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
  actsHeaderActe: {
    flex: 1,
  },
  actsHeaderQte: {
    width: 48,
    textAlign: 'center',
  },
  actsHeaderMontant: {
    width: 80,
    textAlign: 'right',
  },
  actsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  actsRowLast: {
    borderBottomWidth: 0,
  },
  actsActeCol: {
    flex: 1,
    gap: 2,
  },
  actsCode: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  actsLabel: {
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.textSecondary,
  },
  actsQte: {
    width: 48,
    textAlign: 'center',
    fontSize: 14,
    color: Colors.text,
  },
  actsMontant: {
    width: 80,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },

  // Financial summary
  summaryCard: {
    backgroundColor: Colors.borderLight,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  summarySeparator: {
    height: 1,
    backgroundColor: Colors.border,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  summaryTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },

  // Breakdown
  breakdownCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },

  // Vitale badge
  vitaleBadgeRow: {
    marginBottom: 20,
  },

  // Action buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.borderLight,
  },
  actionBtnSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  actionBtnPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },

  // Not found
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.background,
    paddingHorizontal: 32,
  },
  notFoundTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  notFoundText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.primaryUltraLight,
    borderRadius: 10,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },

  bottomSpacer: {
    height: 40,
  },
});
