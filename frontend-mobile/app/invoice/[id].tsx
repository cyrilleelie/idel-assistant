/**
 * InvoiceDetailScreen — Full invoice view with PDF, send, and presentation.
 *
 * Routes: /invoice/{id} (WatermelonDB ID)
 *         /invoice/{id}?appointmentId={appointmentId} (lookup by appointment)
 *
 * Security: FLAG_SECURE active (financial + patient data).
 * Audit: view_invoice, send_invoice.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import InvoiceActsTable from '@/components/invoice/InvoiceActsTable';
import InvoiceSendModal from '@/components/invoice/InvoiceSendModal';
import VitaleStatusBadge from '@/components/invoice/VitaleStatusBadge';
import PdfPresentationMode from '@/components/invoice/PdfPresentationMode';
import Badge from '@/components/ui/Badge';
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
      return 'Validee';
    case 'draft':
      return 'Brouillon';
    case 'cancelled':
      return 'Annulee';
    default:
      return status;
  }
}

function invoiceStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'validated':
      return 'success';
    case 'draft':
      return 'warning';
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
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

  // ── State ─────────────────────────────────────────────────────────────────

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

  // ── Load invoice ──────────────────────────────────────────────────────────

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

  // ── PDF / HTML display ─────────────────────────────────────────────────

  /**
   * Try to load the PDF from cache or server.
   * If download fails, generate HTML invoice locally as fallback.
   * Returns true if content is ready to display.
   */
  const loadDisplayContent = useCallback(async (): Promise<boolean> => {
    if (!invoice) return false;

    // Already loaded
    if (pdfBase64 || invoiceHtml) return true;

    // Check local cache
    const cached = await getCachedPdfPath(database, invoice.id);
    if (cached) {
      try {
        const b64 = await decryptCachedPdf(cached);
        setPdfBase64(b64);
        return true;
      } catch {
        // Cache corrupted — fall through to download
      }
    }

    // Try server download
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
        // Download failed — fall through to HTML fallback
      } finally {
        setIsPdfLoading(false);
      }
    }

    // Fallback: generate HTML invoice from local data
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

  // ── Send actions ──────────────────────────────────────────────────────────

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

  // ── Loading / not found states ────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `Facture ${invoice.invoiceNumber}`,
          headerStyle: styles.headerBar,
          headerTitleStyle: styles.headerTitle,
          headerTintColor: Colors.text,
          headerRight: () => (
            <View style={styles.headerBadge}>
              <Badge
                label={invoiceStatusLabel(invoice.status)}
                variant={invoiceStatusVariant(invoice.status)}
              />
            </View>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Invoice info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Patient</Text>
            <Text style={styles.infoValue}>{invoice.patientName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>
              {invoice.date ? formatDateFrench(invoice.date) : '-'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Numero</Text>
            <Text style={styles.infoValue}>
              {formatInvoiceNumber(invoice.invoiceNumber)}
            </Text>
          </View>
          <View style={[styles.infoRow, styles.infoRowLast]}>
            <Text style={styles.infoLabel}>Montant</Text>
            <Text style={styles.infoValueBold}>{formatAmount(invoice.totalAmount)}</Text>
          </View>
          <View style={styles.badgeRow}>
            <VitaleStatusBadge status={invoice.vitaleStatus} />
          </View>
        </View>

        {/* Acts table */}
        <Text style={styles.sectionTitle}>DETAIL DES ACTES</Text>
        <InvoiceActsTable
          acts={invoice.acts}
          totalAmount={invoice.totalAmount}
          amountAmo={invoice.amountAmo}
          amountAmc={invoice.amountAmc}
          amountPatient={invoice.amountPatient}
        />

        {/* Sharing section */}
        <Text style={styles.sectionTitle}>PARTAGER</Text>
        <View style={styles.actionsContainer}>
          <ActionRow
            icon="document-text-outline"
            label="Voir le PDF"
            onPress={handleViewPdf}
            loading={isPdfLoading}
          />
          <ActionRow
            icon="mail-outline"
            label="Envoyer par email"
            onPress={() => handleOpenSend('email')}
          />
          <ActionRow
            icon="chatbubble-outline"
            label="Envoyer par SMS (lien)"
            onPress={() => handleOpenSend('sms')}
          />
          <ActionRow
            icon="tv-outline"
            label="Presenter au patient"
            onPress={handlePresent}
            loading={isPdfLoading}
          />
        </View>

        {/* Carte Vitale section */}
        <Text style={styles.sectionTitle}>CARTE VITALE</Text>
        <View style={styles.vitaleCard}>
          <Ionicons name="lock-closed-outline" size={20} color={Colors.textTertiary} />
          <View style={styles.vitaleTextArea}>
            <Text style={styles.vitaleTitle}>Validation carte vitale</Text>
            <Text style={styles.vitaleDesc}>
              Disponible dans une version ulterieure.
            </Text>
          </View>
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

      {/* Presentation mode — PDF or HTML fallback */}
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
// ActionRow sub-component
// ---------------------------------------------------------------------------

function ActionRow({
  icon,
  label,
  onPress,
  loading = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.actionRow}
      activeOpacity={0.75}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <Ionicons name={icon} size={20} color={Colors.primary} />
      )}
      <Text style={styles.actionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
    </TouchableOpacity>
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
  headerBadge: {
    marginRight: 8,
  },

  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },

  // Info card
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  infoValueBold: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  badgeRow: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },

  // Sections
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Actions
  actionsContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },

  // Carte Vitale
  vitaleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.borderLight,
    borderRadius: 12,
    padding: 14,
    opacity: 0.7,
  },
  vitaleTextArea: {
    flex: 1,
  },
  vitaleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  vitaleDesc: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
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
