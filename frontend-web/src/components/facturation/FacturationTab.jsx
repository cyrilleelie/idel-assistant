import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt,
  Calendar,
  Check,
  X,
  RefreshCw,
  FileText,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Zap,
  ExternalLink,
  BarChart2,
  TriangleAlert,
  Download,
  Send,
  CheckCircle,
} from 'lucide-react';
import { getDailyBilling, createInvoiceFromAppointment, createAllDailyInvoices } from '../../api/cotation';
import { listInvoices, validateInvoice, cancelInvoice, listRejectedInvoices } from '../../api/invoices';
import { toISODate, formatDateLong } from '../../utils/formatting';
import Badge from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import ErrorBanner from '../ui/ErrorBanner';
import ExpiringPrescriptionsAlert from '../prescriptions/ExpiringPrescriptionsAlert';
import SyntheseTab from './SyntheseTab';
import RejetsTab from './RejetsTab';
import ExportSection from './ExportSection';
import TransmissionTab from './TransmissionTab';

/** Derive initials from a full name string, e.g. "Jean Dupont" -> "JD" */
function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function FacturationTab({ nurses = [], onNavigateToPrescription }) {
  // Onglets principaux
  const [activeFactTab, setActiveFactTab] = useState('jour'); // 'jour' | 'synthese' | 'rejets' | 'exports' | 'transmission'
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [rejetsCount, setRejetsCount] = useState(0);

  // Charge le compteur de rejets non corrigés
  const loadRejetsCount = useCallback(async () => {
    try {
      const list = await listRejectedInvoices();
      const uncorrected = (list || []).filter(r => !r.correction_invoice_id);
      setRejetsCount(uncorrected.length);
    } catch {
      setRejetsCount(0);
    }
  }, []);

  useEffect(() => { loadRejetsCount(); }, [loadRejetsCount]);

  const [date, setDate] = useState(toISODate(new Date()));
  const [billing, setBilling] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);
  const [visibleStatuses, setVisibleStatuses] = useState(
    new Set(['draft'])
    // Seul 'draft' visible par défaut. 'canceled' = orthographe backend US (1 seul 'l')
  );

  const toggleStatus = (status) => {
    setVisibleStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const nurseMap = useMemo(() => {
    const m = new Map();
    for (const n of nurses) {
      m.set(n.userId, `${n.firstName} ${n.lastName}`);
    }
    return m;
  }, [nurses]);

  const getNurseName = (idelId) => nurseMap.get(idelId) || '(Soignant inconnu)';

  const loadBilling = useCallback(async (d) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDailyBilling(d);
      setBilling(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors du chargement de la facturation');
      setBilling(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvoices = useCallback(async (d) => {
    setInvoicesLoading(true);
    try {
      const data = await listInvoices({ date_from: d, date_to: d });
      setInvoices(Array.isArray(data) ? data : data.items || []);
    } catch {
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    loadBilling(date);
    loadInvoices(date);
  }, [date, loadBilling, loadInvoices]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const navigateDate = (delta) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setDate(toISODate(d));
  };

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleInvoiceOne = async (appointmentId) => {
    setActionLoading(prev => ({ ...prev, [appointmentId]: true }));
    try {
      await createInvoiceFromAppointment(appointmentId);
      refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la facturation');
    } finally {
      setActionLoading(prev => ({ ...prev, [appointmentId]: false }));
    }
  };

  const handleInvoiceAll = async () => {
    setActionLoading(prev => ({ ...prev, _all: true }));
    try {
      await createAllDailyInvoices(date);
      refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la facturation groupee');
    } finally {
      setActionLoading(prev => ({ ...prev, _all: false }));
    }
  };

  /** Valide toutes les factures draft auto-générées sans needs_review. */
  const handleValidateAll = async () => {
    const toValidate = invoices.filter(
      inv => inv.status === 'draft' && !inv.metadata?.needs_review
    );
    if (toValidate.length === 0) return;
    setActionLoading(prev => ({ ...prev, _validateAll: true }));
    try {
      await Promise.allSettled(toValidate.map(inv => validateInvoice(inv.id)));
      refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la validation groupée');
    } finally {
      setActionLoading(prev => ({ ...prev, _validateAll: false }));
    }
  };

  const handleValidate = async (invoiceId) => {
    setActionLoading(prev => ({ ...prev, ['v_' + invoiceId]: true }));
    try {
      await validateInvoice(invoiceId);
      refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la validation');
    } finally {
      setActionLoading(prev => ({ ...prev, ['v_' + invoiceId]: false }));
    }
  };

  const handleCancel = async (invoiceId) => {
    setActionLoading(prev => ({ ...prev, ['c_' + invoiceId]: true }));
    try {
      await cancelInvoice(invoiceId);
      refresh();
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'annulation");
    } finally {
      setActionLoading(prev => ({ ...prev, ['c_' + invoiceId]: false }));
    }
  };

  // ── Données calculées ─────────────────────────────────────────────────────

  const appointments = billing?.items || [];

  // Factures par catégorie
  const autoReadyInvoices = invoices.filter(
    inv => inv.status === 'draft' && inv.metadata?.auto_cotation && !inv.metadata?.needs_review
  );
  const needsReviewInvoices = invoices.filter(
    inv => inv.status === 'draft' && inv.metadata?.needs_review
  );
  const validatedInvoices = invoices.filter(inv => inv.status !== 'draft' && inv.status !== 'canceled');

  // RDVs complétés sans facture et sans blocage ordonnance → "à compléter"
  const completedNotInvoiced = appointments.filter(a =>
    a.status === 'completed' && !a.invoice_id && !a.prescription_missing && !a.prescription_incomplete
  );

  // Factures filtrées par statut (pour l'affichage)
  const filteredInvoices = invoices.filter(inv => visibleStatuses.has(inv.status));

  // Stats
  const totalBilled = billing?.total_facture ?? 0;
  const totalNonBilled = billing?.total_non_facture ?? 0;

  // Callback depuis SyntheseTab : navigue vers "Du jour" à une date donnée
  const handleNavigateToJour = useCallback((dateStr) => {
    setDate(dateStr);
    setActiveFactTab('jour');
  }, []);

  // Callback depuis SyntheseTab : navigue vers l'onglet Rejets
  const handleNavigateToRejets = useCallback(() => {
    setActiveFactTab('rejets');
  }, []);

  const tabItems = [
    { key: 'jour', label: 'Du jour' },
    { key: 'synthese', label: 'Synth\u00e8se' },
    { key: 'rejets', label: 'Rejets', badge: rejetsCount > 0 ? rejetsCount : null },
    { key: 'exports', label: 'Exports' },
    { key: 'transmission', label: 'T\u00e9l\u00e9transmission' },
  ];

  return (
    <div className="space-y-6">

      {/* Barre d'onglets */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          {tabItems.map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setActiveFactTab(key)}
              className={`pb-3 text-sm transition-colors ${
                activeFactTab === key
                  ? 'border-b-[3px] border-primary text-primary font-bold'
                  : 'text-slate-500 font-medium hover:text-slate-700'
              }`}
            >
              {label}
              {badge != null && (
                <span className="ml-2 bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[10px]">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu onglet Synthèse */}
      {activeFactTab === 'synthese' && (
        <SyntheseTab
          nurses={nurses}
          period={selectedMonth}
          onPeriodChange={setSelectedMonth}
          onNavigateToJour={handleNavigateToJour}
          onNavigateToRejets={handleNavigateToRejets}
        />
      )}

      {/* Contenu onglet Rejets */}
      {activeFactTab === 'rejets' && (
        <RejetsTab
          onNavigateToJour={handleNavigateToJour}
          onRejetsCountChange={setRejetsCount}
        />
      )}

      {/* Contenu onglet Exports & Comptabilité */}
      {activeFactTab === 'exports' && (
        <ExportSection period={selectedMonth} />
      )}

      {/* Contenu onglet Transmission SESAM-Vitale */}
      {activeFactTab === 'transmission' && (
        <TransmissionTab />
      )}

      {/* Contenu onglet Du jour */}
      {activeFactTab === 'jour' && (
      <div className="space-y-6">

      {/* Date navigation (compact, no action buttons here -- they move into the table header) */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigateDate(-1)}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-slate-400" />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <button
          onClick={() => navigateDate(1)}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Error banner */}
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* KPI Cards — 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: RDV aujourd'hui */}
        <div className="rounded-xl p-5 border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-sm text-slate-600">RDV aujourd'hui</p>
            <Calendar size={18} className="text-slate-400 opacity-50" />
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-1">{appointments.length}</p>
          <p className="text-xs text-slate-400 mt-1">{formatDateLong(date)}</p>
        </div>

        {/* Card 2: Prêts à facturer */}
        <div className="rounded-xl p-5 border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-sm text-slate-600">Pr&ecirc;ts &agrave; facturer</p>
            <CheckCircle size={18} className="text-emerald-500 opacity-50" />
          </div>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{autoReadyInvoices.length}</p>
          {autoReadyInvoices.length > 0 && (
            <p className="text-xs text-emerald-500 mt-1">Validation possible</p>
          )}
        </div>

        {/* Card 3: À vérifier */}
        <div className="rounded-xl p-5 border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-sm text-slate-600">&Agrave; v&eacute;rifier</p>
            <AlertCircle size={18} className="text-amber-500 opacity-50" />
          </div>
          <p className="text-3xl font-bold text-amber-600 mt-1">{needsReviewInvoices.length}</p>
          {needsReviewInvoices.length > 0 && (
            <p className="text-xs text-amber-500 mt-1">Action requise</p>
          )}
        </div>
      </div>

      {/* Alertes ordonnances expirant bientôt */}
      <ExpiringPrescriptionsAlert daysAhead={7} />

      {/* Appointments table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table header bar */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-slate-700">
            Passages du jour &mdash; {formatDateLong(date)}
          </h3>
          <div className="flex items-center gap-2">
            {/* Tout valider */}
            {autoReadyInvoices.length > 0 && (
              <button
                onClick={handleValidateAll}
                disabled={actionLoading._validateAll}
                className="border border-slate-300 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {actionLoading._validateAll
                  ? 'Validation...'
                  : `Tout valider (${autoReadyInvoices.length})`}
              </button>
            )}
            {/* Tout facturer */}
            {completedNotInvoiced.length > 0 && (
              <button
                onClick={handleInvoiceAll}
                disabled={actionLoading._all}
                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {actionLoading._all
                  ? 'Facturation...'
                  : `Tout facturer (${completedNotInvoiced.length})`}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : appointments.length === 0 ? (
          <EmptyState icon={Calendar} title="Aucun rendez-vous pour cette date" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Heure</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">IDEL</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actes</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Alertes</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((appt) => {
                  const time = appt.scheduled_at
                    ? new Date(appt.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    : '--:--';
                  const codes = appt.act_codes || [];
                  const prescriptionWarnings = appt.prescription_warnings || [];
                  const prescriptionBlocked = appt.prescription_missing || appt.prescription_incomplete;
                  const canInvoice = appt.status === 'completed' && !appt.invoice_id && !prescriptionBlocked;
                  const nurseName = getNurseName(appt.idel_id);
                  const nurseInitials = getInitials(nurseName);
                  // Short name: first name only
                  const nurseShort = nurseName.split(' ')[0] || nurseName;
                  return (
                    <tr key={appt.appointment_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-700">{time}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="size-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold inline-flex items-center justify-center flex-shrink-0">
                            {nurseInitials}
                          </span>
                          <span className="text-sm text-slate-600">{nurseShort}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-800">{appt.patient_name || '(Inconnu)'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {codes.length > 0 ? codes.map(code => (
                            <span key={code} className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold">
                              {code}
                            </span>
                          )) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={appt.status} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        {prescriptionWarnings.length > 0 ? (
                          <div className="flex flex-col items-center gap-0.5">
                            {prescriptionWarnings.map((w, i) => (
                              <div key={i} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium w-fit ${
                                prescriptionBlocked
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                <AlertCircle size={10} />
                                {w}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {appt.invoice_id ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                              <Check size={12} />
                              Factur&eacute;e
                            </span>
                          ) : appt.status === 'completed' && (
                            <button
                              onClick={() => canInvoice && handleInvoiceOne(appt.appointment_id)}
                              disabled={!canInvoice || actionLoading[appt.appointment_id]}
                              title={prescriptionBlocked ? prescriptionWarnings.join(' · ') : undefined}
                              className={`px-3 py-1 rounded text-[11px] font-bold transition-colors ${
                                canInvoice
                                  ? 'bg-primary text-white hover:bg-primary/90 disabled:opacity-50'
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {actionLoading[appt.appointment_id] ? '...' : 'Facturer'}
                            </button>
                          )}
                          {(prescriptionBlocked || prescriptionWarnings.length > 0) && onNavigateToPrescription && (
                            <button
                              onClick={() => onNavigateToPrescription(appt.patient_id, appt.care_protocol_id)}
                              className="border border-slate-300 px-3 py-1 rounded text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                              title="Ouvrir le plan de soins pour vérifier l'ordonnance"
                            >
                              Ordonnance
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoices section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* En-tête : titre + compteurs */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Factures g&eacute;n&eacute;r&eacute;es</h3>
          {invoices.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {autoReadyInvoices.length > 0 && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <Zap size={11} /> {autoReadyInvoices.length} auto
                </span>
              )}
              {needsReviewInvoices.length > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertCircle size={11} /> {needsReviewInvoices.length} &agrave; v&eacute;rifier
                </span>
              )}
              {validatedInvoices.length > 0 && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <Check size={11} /> {validatedInvoices.length} valid&eacute;e{validatedInvoices.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Barre de filtres par statut */}
        <div className="px-5 py-2.5 border-b border-slate-100 flex flex-wrap gap-2">
          {[
            { key: 'draft',     label: 'Brouillon', activeClass: 'bg-slate-200 text-slate-700 border-slate-300' },
            { key: 'validated', label: 'Valid\u00e9e',   activeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
            { key: 'transmitted', label: 'Envoy\u00e9e',   activeClass: 'bg-primary/10 text-primary border-primary/30' },
            { key: 'paid',      label: 'Pay\u00e9e',     activeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
            { key: 'canceled',  label: 'Annul\u00e9e',   activeClass: 'bg-red-100 text-red-600 border-red-300' },
          ].map(({ key, label, activeClass }) => {
            const count = invoices.filter(inv => inv.status === key).length;
            const isOn = visibleStatuses.has(key);
            // Pas de factures avec ce statut aujourd'hui : chip grisé non cliquable
            if (count === 0) {
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-50 text-slate-300 border-slate-200 cursor-default select-none"
                  title="Aucune facture avec ce statut aujourd'hui"
                >
                  {label}
                  <span className="rounded-full px-1 text-[10px] font-semibold">0</span>
                </span>
              );
            }
            return (
              <button
                key={key}
                onClick={() => toggleStatus(key)}
                title={isOn ? `Masquer les factures "${label}"` : `Afficher les factures "${label}" (${count})`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  isOn
                    ? activeClass
                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400 hover:text-slate-600'
                }`}
              >
                {label}
                <span className={`rounded-full px-1 text-[10px] font-semibold ${isOn ? 'bg-white/50' : ''}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {invoicesLoading ? (
          <LoadingSpinner />
        ) : invoices.length === 0 ? (
          <EmptyState icon={FileText} title="Aucune facture pour cette date" />
        ) : filteredInvoices.length === 0 ? (
          <EmptyState icon={FileText} title="Aucune facture ne correspond aux filtres actifs" />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredInvoices.map((inv) => {
              const isExpanded = expandedInvoiceId === inv.id;
              const lines = inv.lines || [];
              const isAuto = inv.metadata?.auto_cotation === true;
              const needsReview = inv.metadata?.needs_review === true;
              const reviewReason = inv.metadata?.review_reason;

              return (
                <div
                  key={inv.id}
                  className={needsReview ? 'border-l-2 border-amber-400' : ''}
                >
                  {/* Invoice header row */}
                  <button
                    type="button"
                    onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <ChevronDown size={16} className={`text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {inv.invoice_number || 'Brouillon'}
                          </p>
                          {/* Badge Auto */}
                          {isAuto && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-600 border border-emerald-200">
                              <Zap size={9} /> Auto
                            </span>
                          )}
                          {/* Badge À vérifier */}
                          {needsReview && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertCircle size={9} /> &Agrave; v&eacute;rifier
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {getNurseName(inv.idel_id)} &mdash; {inv.patient_name || 'Patient'} &mdash; {Number(inv.total_amount ?? 0).toFixed(2)} &euro;
                        </p>
                        {/* Raison needs_review */}
                        {needsReview && reviewReason && (
                          <p className="text-[10px] text-amber-600 mt-0.5 truncate">{reviewReason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={inv.status} />
                    </div>
                  </button>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div className="px-6 pb-4 bg-slate-50/50 border-t border-slate-100">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-3">
                        <div>
                          <p className="text-xs text-slate-400">Soignant</p>
                          <p className="text-sm text-slate-700 font-medium">{getNurseName(inv.idel_id)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Date soins</p>
                          <p className="text-sm text-slate-700">{inv.care_date || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Date facture</p>
                          <p className="text-sm text-slate-700">{inv.invoice_date || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Tiers payant</p>
                          <p className="text-sm text-slate-700 capitalize">{inv.tiers_payant_type || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Statut</p>
                          <div className="mt-0.5"><Badge variant={inv.status} /></div>
                        </div>
                      </div>

                      {/* Lines table */}
                      {lines.length > 0 ? (
                        <div className="border border-slate-200 rounded-lg overflow-hidden mt-1">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-100 text-left">
                                <th className="px-3 py-2 text-xs font-medium text-slate-500">Code</th>
                                <th className="px-3 py-2 text-xs font-medium text-slate-500">Acte</th>
                                <th className="px-3 py-2 text-xs font-medium text-slate-500 text-right">Coeff.</th>
                                <th className="px-3 py-2 text-xs font-medium text-slate-500 text-right">Tarif</th>
                                <th className="px-3 py-2 text-xs font-medium text-slate-500 text-right">Qt&eacute;</th>
                                <th className="px-3 py-2 text-xs font-medium text-slate-500 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {lines.map((line) => (
                                <tr key={line.id}>
                                  <td className="px-3 py-2">
                                    <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-mono font-bold">{line.act_code}</span>
                                  </td>
                                  <td className="px-3 py-2 text-slate-700">{line.act_label}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{Number(line.coefficient ?? 1)}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{Number(line.base_rate ?? 0).toFixed(2)}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{Number(line.quantity ?? 1)}</td>
                                  <td className="px-3 py-2 text-right font-medium text-slate-800">{Number(line.line_total ?? 0).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic py-2">Aucune ligne d'acte.</p>
                      )}

                      {/* Totals breakdown */}
                      <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">AMO (60%) :</span>
                          <span className="text-sm font-medium text-slate-700">{Number(inv.total_amo ?? 0).toFixed(2)} &euro;</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">AMC (40%) :</span>
                          <span className="text-sm font-medium text-slate-700">{Number(inv.total_amc ?? 0).toFixed(2)} &euro;</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">Patient :</span>
                          <span className="text-sm font-medium text-slate-700">{Number(inv.total_patient ?? 0).toFixed(2)} &euro;</span>
                        </div>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="text-xs text-slate-500 font-medium">Total :</span>
                          <span className="text-sm font-semibold text-slate-900">{Number(inv.total_amount ?? 0).toFixed(2)} &euro;</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {(inv.status === 'draft' || inv.status === 'validated') && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
                          {inv.status === 'draft' && (
                            <button
                              onClick={() => handleValidate(inv.id)}
                              disabled={actionLoading['v_' + inv.id]}
                              className="bg-emerald-600 text-white px-3 py-1 rounded text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading['v_' + inv.id] ? 'Validation...' : 'Valider'}
                            </button>
                          )}
                          <button
                            onClick={() => handleCancel(inv.id)}
                            disabled={actionLoading['c_' + inv.id]}
                            className="border border-red-200 text-red-600 px-3 py-1 rounded text-[11px] font-bold hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading['c_' + inv.id] ? 'Annulation...' : 'Annuler'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
      )}
    </div>
  );
}
